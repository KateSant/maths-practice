package com.realmaths.question;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuestionRepository extends JpaRepository<Question, Long> {

    /**
     * Picks question ids at random in the database, avoiding the "order by random()
     * with a fetched collection" trap (Hibernate would paginate in memory).
     *
     * <p>Only {@code PUBLISHED} questions are dealt. Drafts are deliberately allowed to be
     * half-written, so serving one would show a student an unanswerable question.
     */
    @Query(value = """
            select id from questions
            where status = 'PUBLISHED'
            order by random()
            limit :count
            """, nativeQuery = true)
    List<Long> pickRandomIds(@Param("count") int count);

    @Query(value = """
            select id from questions
            where status = 'PUBLISHED' and topic_id = :topicId
            order by random()
            limit :count
            """, nativeQuery = true)
    List<Long> pickRandomIdsForTopic(@Param("topicId") Long topicId, @Param("count") int count);

    /** Loads the chosen questions and their options in one round trip. */
    @Query("select distinct q from Question q join fetch q.options where q.id in :ids")
    List<Question> findAllWithOptionsByIdIn(@Param("ids") Collection<Long> ids);

    /** One query for the topic list, instead of a count query per topic. */
    @Query("""
            select q.topic.id as topicId, count(q) as total
            from Question q
            where q.status = :status
            group by q.topic.id
            """)
    List<TopicQuestionCount> countByTopicWithStatus(@Param("status") QuestionStatus status);

    /**
     * The admin question list.
     *
     * <p>Filters are optional and expressed as {@code :param is null or ...}, which keeps one
     * query rather than a combinatorial set of them. The topic is fetch-joined because every
     * row displays its name; that is a many-to-one, so unlike a collection fetch it does not
     * force Hibernate to page in memory. Options are deliberately <em>not</em> joined: a list
     * row does not show them, and joining a collection here would.
     *
     * <p>The count query is given explicitly because Spring Data cannot derive one from a
     * fetch-joined select.
     */
    @Query(
            value = """
                    select q from Question q
                    join fetch q.topic
                    where (:topicId is null or q.topic.id = :topicId)
                      and (:status is null or q.status = :status)
                      and (:difficulty is null or q.difficulty = :difficulty)
                      and (:origin is null or q.origin = :origin)
                      and (:search is null or lower(q.prompt) like lower(concat('%', :search, '%')))
                    """,
            countQuery = """
                    select count(q) from Question q
                    where (:topicId is null or q.topic.id = :topicId)
                      and (:status is null or q.status = :status)
                      and (:difficulty is null or q.difficulty = :difficulty)
                      and (:origin is null or q.origin = :origin)
                      and (:search is null or lower(q.prompt) like lower(concat('%', :search, '%')))
                    """)
    Page<Question> search(
            @Param("topicId") Long topicId,
            @Param("status") QuestionStatus status,
            @Param("difficulty") Integer difficulty,
            @Param("origin") QuestionOrigin origin,
            @Param("search") String search,
            Pageable pageable);

    /**
     * Loads one question with everything the editor needs, in a single query.
     *
     * <p>A separate method from {@code findById} because the editor always wants the options,
     * and because this is the one place the caller wants to see which option is correct.
     *
     * <p>{@code left join} on the options is load-bearing, not defensive style: a draft is
     * allowed to have no options yet, and an inner fetch join would match no rows at all, so the
     * editor would report a 404 for a question that plainly exists.
     */
    @Query("select distinct q from Question q left join fetch q.options join fetch q.topic where q.id = :id")
    java.util.Optional<Question> findDetailedById(@Param("id") Long id);

    interface TopicQuestionCount {
        Long getTopicId();

        long getTotal();
    }
}
