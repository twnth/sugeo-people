package com.clothmap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import java.io.IOException;
@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<?> bad(IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("code","BAD_REQUEST","message",e.getMessage())); }
  @ExceptionHandler(IllegalStateException.class)
  ResponseEntity<?> conflict(IllegalStateException e) { return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code","CONFLICT","message",e.getMessage())); }
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> status(ResponseStatusException e) { return ResponseEntity.status(e.getStatusCode()).body(Map.of("code",e.getStatusCode().toString(),"message",e.getReason()==null?"요청을 처리할 수 없습니다.":e.getReason())); }
  @ExceptionHandler({HttpMessageNotReadableException.class,MissingServletRequestParameterException.class,MissingServletRequestPartException.class,MethodArgumentTypeMismatchException.class})
  ResponseEntity<?> malformed(Exception e) { return ResponseEntity.badRequest().body(Map.of("code","BAD_REQUEST","message","요청 형식 또는 값을 확인해주세요.")); }
  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<?> validation(MethodArgumentNotValidException e) { return ResponseEntity.badRequest().body(Map.of("code","VALIDATION_ERROR","message","입력값을 확인해주세요.")); }
  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<?> tooLarge(Exception e) { return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("code","PHOTO_TOO_LARGE","message","사진은 5MB 이하로 선택해주세요.")); }
  @ExceptionHandler(IOException.class)
  ResponseEntity<?> storage(Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("code","PHOTO_STORAGE_ERROR","message","사진을 처리하지 못했습니다.")); }
}
