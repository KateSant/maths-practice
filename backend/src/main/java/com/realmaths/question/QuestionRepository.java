package com.realmaths.question;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuestionRepository extends JpaRepository<Question, Long> {

    /**
     * Picks question ids at random in the database, avoiding the "order by random()
     * with a fetched collection" trap (Hibernate would paginate in memory).
     */
    @Query(value = """
            select id from questions
            where active = true
            order by random()
            limit :count
            """, nativeQuery = true)
    List<Long> pickRandomIds(@Param("count") int count);

    @Query(value = """
            select id from questions
            where active = true and topic_id = :topicId
            order by random()
            limit :count
            """, nativeQuery = true)
    List<Long> pickRandomIdsForTopic(@Param("topicId") Long topicId, @Param("count") int count);

    /** Loads the chosen questions and their options in one round trip. */
    @Query("select distinct q from Question q join fetch q.options where q.id in :ids")
    List<Question> findAllWithOptionsByIdIn(@Param("ids") Collection<Long> ids);

    @Query("select q.id from Question q where q.active = true")
    List<Long> findAllActiveIds();

    /** One query for the topic list, instead of a count query per topic. */
    @Query("""
            select q.topic.id as topicId, count(q) as total
            from Question q
            where q.active = true
            group by q.topic.id
            """)
    List<TopicQuestionCount> countActiveByTopic();

    interface TopicQuestionCount {
        Long getTopicId();

        long getTotal();
    }

    long countByTopicIdAndActiveTrue(Long topicId);

    long countByActiveTrue();
}
