package com.realmaths.admin.dto;

import java.util.List;

/**
 * What a topic can actually offer, band by band.
 *
 * <p>This is the other half of the adaptive sets: those are aimed at the band a student is
 * working at, so a band with no published questions is a level that student can never be dealt.
 * A single question count per topic cannot show that, which is why this exists rather than a
 * number on {@link AdminTopicView}.
 */
public record CoverageView(
        Long topicId,
        String topicName,
        List<BandCount> bands,
        long published,
        /** Whether there are enough published questions to fill a full set. */
        boolean canFillASet) {

    public record BandCount(int band, long questions) {}
}
