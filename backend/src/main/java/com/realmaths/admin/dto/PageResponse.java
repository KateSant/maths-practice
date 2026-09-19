package com.realmaths.admin.dto;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * A page of results, shaped for this API rather than exposing Spring's {@code Page}.
 *
 * <p>Spring's own serialisation is verbose, unstable between versions, and describes things the
 * client cannot use. This is the whole contract: the rows, where we are, and how much there is.
 */
public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {

    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(
                page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }
}
