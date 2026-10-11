package com.tr1kz7.common;

import com.tr1kz7.DTO.Result;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** 把切面拒绝访问的异常转换成接口约定的 JSON 响应。 */
@RestControllerAdvice
public class AuthorizationExceptionHandler {

    @ExceptionHandler(AuthorizationException.class)
    public ResponseEntity<Result> handle(AuthorizationException exception) {
        int status = exception.getStatus();
        return ResponseEntity.status(status).body(Result.fail(status, exception.getMessage()));
    }
}
