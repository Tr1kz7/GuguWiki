package com.tr1kz7.DTO;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


/**
 * 返回的结果类
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Result {
    private Integer code;
    private Object data;
    private String message;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String token;


    public static Result success(Integer code,String message) {
        return new Result(code, null, message, null);
    }

    public static Result success(Integer code,Object data,String message) {
        return new Result(code, data, message, null);
    }

    public static Result success(Integer code,Object[] data) {
        return new Result(code, data, null, null);
    }

    public static Result success(Integer code,Object data,String message,String token) {
        return new Result(code, data, message, token);
    }

    public static Result fail(Integer code,String message) {
        return new Result(code, null, message, null);
    }

}
