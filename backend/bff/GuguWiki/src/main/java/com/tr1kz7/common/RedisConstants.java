package com.tr1kz7.common;

public class RedisConstants {

    //保存登录token，用来确认用户身份
    public static final String LOGIN_TOKEN = "login:token:";
    //用户token有效期
    public static final Long LOGIN_TOKEN_TTL = 300L;
}
