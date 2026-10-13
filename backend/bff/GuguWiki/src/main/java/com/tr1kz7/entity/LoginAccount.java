package com.tr1kz7.entity;

import lombok.Data;

import java.util.UUID;

/**
 * 接收存储数据库查出的用户信息，便于比较登陆密码和hash密码结果
 * */
@Data
public class LoginAccount {
    private UUID id;
    private String name;
    private String email;
    private String role;
    private String passwordHash;
    private boolean enabled;
}
