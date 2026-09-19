package com.realmaths.question;

import com.realmaths.question.dto.TopicView;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    private final QuestionCatalogService catalogService;

    public TopicController(QuestionCatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public List<TopicView> listTopics() {
        return catalogService.listTopics();
    }
}
