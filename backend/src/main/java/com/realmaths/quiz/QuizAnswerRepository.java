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

    interface TopicAccuracy {
        Long getTopicId();

        String getTopicName();

        long getAnswered();

        Long getCorrect();
    }
}
