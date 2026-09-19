# Multi-stage build: compile with Maven, then run on a slim JRE.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
# Copy the POM first so dependency resolution is cached between builds.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
# Run as a non-root user.
RUN addgroup -S realmaths && adduser -S realmaths -G realmaths \
    && mkdir -p /data && chown -R realmaths:realmaths /data
COPY --from=build /build/target/*.jar app.jar
USER realmaths
EXPOSE 8081
# Cap the heap so the JVM leaves room for the rest of a small instance.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60"
ENTRYPOINT ["java", "-jar", "app.jar"]
