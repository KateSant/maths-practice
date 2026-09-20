package com.realmaths.question;

import com.realmaths.question.dto.TopicView;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    private final QuestionCatalogService catalogService;

    public TopicController(QuestionCatalogService catalogService) {
        this.catalogService = catalogService;
    }

    /**
     * @param yearGroup optional; the year group the student has chosen. When given, only topics
     *     with published questions for that year are returned, and the counts describe that year.
     *     Omitting it counts the whole bank instead.
     */
    @GetMapping
    public List<TopicView> listTopics(@RequestParam(required = false) Integer yearGroup) {
        return catalogService.listTopics(yearGroup);
    }
}
