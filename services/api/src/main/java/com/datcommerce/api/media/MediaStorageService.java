package com.datcommerce.api.media;

import com.datcommerce.api.audit.AuditLogService;
import com.datcommerce.api.common.config.AppProperties;
import com.datcommerce.api.common.exception.ApiException;
import com.datcommerce.api.common.exception.ErrorCode;
import com.datcommerce.api.common.security.AuthenticatedUser;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.PutBucketPolicyRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class MediaStorageService {

    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
    );

    private final S3Client s3Client;
    private final MediaAssetRepository mediaRepository;
    private final AppProperties appProperties;
    private final AuditLogService auditLogService;
    private volatile boolean bucketReady = false;

    public MediaStorageService(
            S3Client s3Client,
            MediaAssetRepository mediaRepository,
            AppProperties appProperties,
            AuditLogService auditLogService
    ) {
        this.s3Client = s3Client;
        this.mediaRepository = mediaRepository;
        this.appProperties = appProperties;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public List<MediaAssetResponse> list(UUID storeId) {
        return mediaRepository.findAllByStoreIdOrderByCreatedAtDesc(storeId).stream()
                .map(MediaAssetResponse::from)
                .toList();
    }

    @Transactional
    public MediaAssetResponse upload(AuthenticatedUser actor, MultipartFile file, String altText) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Image file is required");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "File exceeds 5 MB limit");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!ALLOWED_MIME_TYPES.contains(contentType)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Only JPEG, PNG, WebP, and GIF images are allowed");
        }

        ensureBucketReady();

        String originalName = StringUtils.hasText(file.getOriginalFilename())
                ? file.getOriginalFilename()
                : "upload.png";
        String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safeName.length() > 80) {
            safeName = safeName.substring(safeName.length() - 80);
        }

        UUID id = UUID.randomUUID();
        String bucket = appProperties.getStorage().getBucket();
        String key = "stores/" + actor.storeId() + "/" + id + "-" + safeName;

        try {
            byte[] bytes = file.getBytes();
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(contentType)
                            .contentLength((long) bytes.length)
                            .build(),
                    RequestBody.fromBytes(bytes)
            );
        } catch (IOException ex) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Failed to read uploaded file");
        }

        String prefix = appProperties.getStorage().getPublicUrlPrefix().replaceAll("/+$", "");
        String publicUrl = prefix + "/" + bucket + "/" + key;

        MediaAssetEntity entity = new MediaAssetEntity();
        entity.setId(id);
        entity.setStoreId(actor.storeId());
        entity.setStorageKey(key);
        entity.setUrl(publicUrl);
        entity.setOriginalFilename(originalName);
        entity.setMimeType(contentType);
        entity.setSizeBytes(file.getSize());
        entity.setAltText(StringUtils.hasText(altText) ? altText.trim() : originalName);
        entity.setCreatedAt(Instant.now());

        MediaAssetEntity saved = mediaRepository.save(entity);

        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "MEDIA_UPLOADED",
                "MEDIA_ASSET",
                saved.getId().toString(),
                null,
                Map.of("url", saved.getUrl(), "mimeType", saved.getMimeType(), "sizeBytes", saved.getSizeBytes()),
                Map.of(),
                null
        );

        return MediaAssetResponse.from(saved);
    }

    @Transactional
    public FontUploadResponse uploadFont(AuthenticatedUser actor, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Font file is required");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Font file exceeds 5 MB limit");
        }
        String originalName = StringUtils.hasText(file.getOriginalFilename())
                ? file.getOriginalFilename().trim()
                : "";
        String lowerName = originalName.toLowerCase(Locale.ROOT);
        String ext;
        String mimeType;
        String format;
        if (lowerName.endsWith(".woff2")) {
            ext = "woff2";
            mimeType = "font/woff2";
            format = "woff2";
        } else if (lowerName.endsWith(".woff")) {
            ext = "woff";
            mimeType = "font/woff";
            format = "woff";
        } else if (lowerName.endsWith(".ttf")) {
            ext = "ttf";
            mimeType = "font/ttf";
            format = "truetype";
        } else {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Only WOFF2, WOFF, and TTF font files are supported");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Failed to read uploaded font file");
        }
        if (!hasValidFontMagic(bytes, ext)) {
            throw new ApiException(ErrorCode.BAD_REQUEST, "Uploaded file header does not match ." + ext + " font format");
        }

        ensureBucketReady();
        String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safeName.length() > 80) {
            safeName = safeName.substring(safeName.length() - 80);
        }
        UUID id = UUID.randomUUID();
        String bucket = appProperties.getStorage().getBucket();
        String key = "stores/" + actor.storeId() + "/fonts/" + id + "-" + safeName;

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(mimeType)
                        .contentLength((long) bytes.length)
                        .build(),
                RequestBody.fromBytes(bytes)
        );

        String prefix = appProperties.getStorage().getPublicUrlPrefix().replaceAll("/+$", "");
        String publicUrl = prefix + "/" + bucket + "/" + key;

        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "FONT_UPLOADED",
                "THEME_FONT",
                id.toString(),
                null,
                Map.of("url", publicUrl, "mimeType", mimeType, "format", format, "sizeBytes", bytes.length),
                Map.of(),
                null
        );

        return new FontUploadResponse(publicUrl, originalName, mimeType, format, bytes.length);
    }

    private static boolean hasValidFontMagic(byte[] bytes, String ext) {
        if (bytes == null || bytes.length < 4) {
            return false;
        }
        return switch (ext) {
            case "woff2" -> bytes[0] == 'w' && bytes[1] == 'O' && bytes[2] == 'F' && bytes[3] == '2';
            case "woff" -> bytes[0] == 'w' && bytes[1] == 'O' && bytes[2] == 'F' && bytes[3] == 'F';
            case "ttf" -> (bytes[0] == 0x00 && bytes[1] == 0x01 && bytes[2] == 0x00 && bytes[3] == 0x00)
                    || (bytes[0] == 't' && bytes[1] == 'r' && bytes[2] == 'u' && bytes[3] == 'e')
                    || (bytes[0] == 'O' && bytes[1] == 'T' && bytes[2] == 'T' && bytes[3] == 'O');
            default -> false;
        };
    }

    @Transactional
    public void delete(AuthenticatedUser actor, UUID mediaId) {
        MediaAssetEntity asset = mediaRepository.findByIdAndStoreId(mediaId, actor.storeId())
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Media asset not found"));

        ensureBucketReady();
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(appProperties.getStorage().getBucket())
                .key(asset.getStorageKey())
                .build());

        mediaRepository.delete(asset);

        auditLogService.record(
                actor.storeId(),
                actor.userId(),
                actor.email(),
                "MEDIA_DELETED",
                "MEDIA_ASSET",
                asset.getId().toString(),
                Map.of("url", asset.getUrl(), "storageKey", asset.getStorageKey()),
                null,
                Map.of(),
                null
        );
    }

    private synchronized void ensureBucketReady() {
        if (bucketReady) {
            return;
        }
        String bucket = appProperties.getStorage().getBucket();
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (NoSuchBucketException ex) {
            s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            } else {
                throw ex;
            }
        }

        String policy = """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": "*",
                      "Action": ["s3:GetObject"],
                      "Resource": ["arn:aws:s3:::%s/*"]
                    }
                  ]
                }
                """.formatted(bucket);
        try {
            s3Client.putBucketPolicy(PutBucketPolicyRequest.builder()
                    .bucket(bucket)
                    .policy(policy)
                    .build());
        } catch (S3Exception ignored) {
            // Some S3-compatible providers ignore PutBucketPolicy when already configured.
        }
        bucketReady = true;
    }

    public record MediaAssetResponse(
            UUID id,
            String storageKey,
            String url,
            String originalFilename,
            String mimeType,
            long sizeBytes,
            String altText,
            Instant createdAt
    ) {
        static MediaAssetResponse from(MediaAssetEntity e) {
            return new MediaAssetResponse(
                    e.getId(),
                    e.getStorageKey(),
                    e.getUrl(),
                    e.getOriginalFilename(),
                    e.getMimeType(),
                    e.getSizeBytes(),
                    e.getAltText(),
                    e.getCreatedAt()
            );
        }
    }

    public record FontUploadResponse(
            String url,
            String originalFilename,
            String mimeType,
            String format,
            long sizeBytes
    ) {
    }
}
