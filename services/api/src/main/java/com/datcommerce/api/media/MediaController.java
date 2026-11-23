package com.datcommerce.api.media;

import com.datcommerce.api.common.security.AuthenticatedUser;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/media")
public class MediaController {

    private final MediaStorageService mediaStorageService;

    public MediaController(MediaStorageService mediaStorageService) {
        this.mediaStorageService = mediaStorageService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('catalog:read', 'content:read')")
    public List<MediaStorageService.MediaAssetResponse> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return mediaStorageService.list(user.storeId());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('media:write')")
    public MediaStorageService.MediaAssetResponse upload(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String altText
    ) {
        return mediaStorageService.upload(user, file, altText);
    }

    @DeleteMapping("/{mediaId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('media:write')")
    public void delete(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID mediaId
    ) {
        mediaStorageService.delete(user, mediaId);
    }
}
