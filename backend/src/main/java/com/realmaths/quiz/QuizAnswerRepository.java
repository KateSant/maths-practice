package com.realmaths.quiz;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuizAnswerRepository extends JpaRepository<QuizAnswer, Long> {

    Optional<QuizAnswer> findBySessionIdAndQuestionId(Long sessionId, Long questionId);

    long countBySessionId(Long sessionId);

    /** Everything needed to render a review screen, in one round trip. */
    @Query("""
            select a from QuizAnswer a
            join fetch a.question q
            join fetch q.options
            left join fetch a.selectedOption
            where a.session.id = :sessionId
            order by a.id asc
            """)
    List<QuizAnswer> findDetailedBySessionId(@Param("sessionId") Long sessionId);

    @Query("select count(a) from QuizAnswer a where a.session.user.id = :userId")
    long countByUserId(@Param("userId") Long userId);

    @Query("select count(a) from QuizAnswer a where a.session.user.id = :userId and a.correct = true")
    long countCorrectByUserId(@Param("userId") Long userId);

    @Query("""
            select a.question.topic.id as topicId,
                   a.question.topic.name as topicName,
                   a.question.topic.sortOrder as sortOrder,
                   count(a) as answered,
                   sum(case when a.correct = true then 1 else 0 end) as correct
            from QuizAnswer a
            where a.session.user.id = :userId
            group by a.question.topic.id, a.question.topic.name, a.question.topic.sortOrder
            order by a.question.topic.sortOrder
            """)
    List<TopicAccuracy> accuracyByTopicForUser(@Param("userId") Long userId);

    /**
     * Recent form per topic: the newest {@code perTopic} answers in each, which is what decides
     * the difficulty of the next set.
     *
     * <p>Recency rather than a calendar window, so "did badly last week" shapes this week's set
     * without the query going empty the moment somebody takes a break. One query with a window
     * function rather than one per topic, because the topic list wants all of them at once.
     *
     * <p>{@code excludeSessionId} answers "where was this student before the set I am summarising?"
     * by ignoring that set's own answers. Null excludes nothing.
     */
    @Query(value = """
            select topic_id as topicId,
                   count(*) as answered,
                   coalesce(sum(is_correct), 0) as correct
            from (
                select q.topic_id as topic_id,
                       a.is_correct as is_correct,
                       row_number() over (partition by q.topic_id order by a.id desc) as rn
                from quiz_answers a
                join questions q on q.id = a.question_id
                join quiz_sessions s on s.id = a.session_id
                where s.user_id = :userId
                  and (:excludeSessionId is null or a.session_id <> :excludeSessionId)
            )
            where rn <= :perTopic
            group by topic_id
            """, nativeQuery = true)
    List<RecentTopicAccuracy> recentAccuracyByTopic(
            @Param("userId") Long userId,
            @Param("perTopic") int perTopic,
            @Param("excludeSessionId") Long excludeSessionId);

    interface TopicAccuracy {
        Long getTopicId();

        String getTopicName();

        long getAnswered();

        Long getCorrect();
    }

    interface RecentTopicAccuracy {
        Long getTopicId();

        long getAnswered();

        long getCorrect();
    }
}
