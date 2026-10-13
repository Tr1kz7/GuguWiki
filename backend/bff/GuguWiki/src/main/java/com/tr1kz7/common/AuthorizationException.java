package com.tr1kz7.common;

/**
* 接收切面注入出现的异常
* */
public class AuthorizationException extends RuntimeException {
    private final int status;

    public AuthorizationException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
