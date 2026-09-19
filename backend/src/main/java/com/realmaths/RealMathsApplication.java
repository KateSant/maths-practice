package com.realmaths;

import com.realmaths.config.RealMathsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(RealMathsProperties.class)
public class RealMathsApplication {

    public static void main(String[] args) {
        SpringApplication.run(RealMathsApplication.class, args);
    }
}
