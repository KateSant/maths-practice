package com.realmaths.profile.dto;

import com.realmaths.auth.dto.UserResponse;

public record ProfileView(UserResponse user, StatsView stats) {}
