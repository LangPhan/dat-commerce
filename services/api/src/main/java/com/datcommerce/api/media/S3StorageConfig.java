package com.datcommerce.api.media;

import com.datcommerce.api.common.config.AppProperties;
import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
public class S3StorageConfig {

    @Bean
    public S3Client s3Client(AppProperties properties) {
        AppProperties.Storage storage = properties.getStorage();
        return S3Client.builder()
                .endpointOverride(URI.create(storage.getEndpoint()))
                .region(Region.of(storage.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(storage.getAccessKey(), storage.getSecretKey())
                ))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
    }
}
