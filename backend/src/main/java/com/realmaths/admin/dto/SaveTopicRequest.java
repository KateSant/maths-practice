package com.realmaths.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * A topic as submitted by the admin editor.
 *
 * <p>The slug is public — it is what quiz links carry — so it is constrained to something
 * URL-safe rather than left free text.
 */
public record SaveTopicRequest(
        @NotBlank(message = "A topic needs a slug.")
                @Size(max = 60, message = "Slugs are limited to 60 characters.")
                @Pattern(
                        regexp = "[a-z0-9]+(-[a-z0-9]+)*",
                        message = "Use lower-case letters, numbers and hyphens, like 'ratio-proportion'.")
                String slug,
        @NotBlank(message = "A topic needs a name.")
                @Size(max = 120, message = "Names are limited to 120 characters.")
                String name,
        @Size(max = 400, message = "Descriptions are limited to 400 characters.") String description,
        int sortOrder) {}
