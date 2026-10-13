package com.tr1kz7.entity;

import lombok.Getter;
import lombok.Setter;

/**
 * 用来接收管理员创建的用户
 */
@Getter
@Setter
public class NewUser {
    private String name;
    private String email;
    private String role;
    private String initialPassword;
}
