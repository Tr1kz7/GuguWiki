package com.tr1kz7.common;

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
