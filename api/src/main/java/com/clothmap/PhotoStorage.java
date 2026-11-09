package com.clothmap;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Iterator;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class PhotoStorage {
  private static final int MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  private final Path root;

  PhotoStorage(@Value("${app.photo-storage-dir}") String directory) {
    root = Path.of(directory).toAbsolutePath().normalize();
  }

  String save(MultipartFile upload) throws IOException {
    if (upload.isEmpty() || upload.getSize() > MAX_UPLOAD_BYTES) {
      throw new IllegalArgumentException("사진은 5MB 이하의 JPG 또는 PNG 파일이어야 합니다.");
    }
    byte[] source = upload.getBytes();
    if (source.length == 0 || source.length > MAX_UPLOAD_BYTES) {
      throw new IllegalArgumentException("사진은 5MB 이하의 JPG 또는 PNG 파일이어야 합니다.");
    }
    BufferedImage image;
    try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
      if (stream == null) throw new IllegalArgumentException("사진을 읽을 수 없습니다.");
      Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
      if (!readers.hasNext()) throw new IllegalArgumentException("JPG 또는 PNG 사진만 업로드할 수 있습니다.");
      ImageReader reader = readers.next();
      try {
        String format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
        if (!format.equals("jpeg") && !format.equals("png")) {
          throw new IllegalArgumentException("JPG 또는 PNG 사진만 업로드할 수 있습니다.");
        }
        reader.setInput(stream, true, true);
        int width = reader.getWidth(0), height = reader.getHeight(0);
        if (width < 1 || height < 1 || width > 6000 || height > 6000 || (long) width * height > 20_000_000) {
          throw new IllegalArgumentException("사진 해상도가 너무 큽니다.");
        }
        image = reader.read(0);
      } finally {
        reader.dispose();
      }
    } catch (javax.imageio.IIOException damaged) {
      throw new IllegalArgumentException("사진 파일이 손상됐습니다.", damaged);
    }
    if (image == null) throw new IllegalArgumentException("사진을 읽을 수 없습니다.");
    int width = image.getWidth(), height = image.getHeight();
    double scale = Math.min(1.0, 1600.0 / Math.max(width, height));
    int outWidth = Math.max(1, (int) Math.round(width * scale));
    int outHeight = Math.max(1, (int) Math.round(height * scale));
    BufferedImage clean = new BufferedImage(outWidth, outHeight, BufferedImage.TYPE_INT_RGB);
    Graphics2D graphics = clean.createGraphics();
    try {
      graphics.setColor(Color.WHITE);
      graphics.fillRect(0, 0, outWidth, outHeight);
      graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
      graphics.drawImage(image, 0, 0, outWidth, outHeight, null);
    } finally {
      graphics.dispose();
    }
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    if (!ImageIO.write(clean, "jpeg", output) || output.size() > MAX_UPLOAD_BYTES) {
      throw new IllegalArgumentException("사진을 저장할 수 없습니다.");
    }
    Files.createDirectories(root);
    String key = UUID.randomUUID() + ".jpg";
    Files.write(root.resolve(key), output.toByteArray(), StandardOpenOption.CREATE_NEW);
    return key;
  }

  byte[] read(String key) throws IOException {
    validateKey(key);
    return Files.readAllBytes(root.resolve(key));
  }

  void delete(String key) throws IOException {
    validateKey(key);
    Files.deleteIfExists(root.resolve(key));
  }

  private void validateKey(String key) {
    if (key == null || !key.matches("[0-9a-f-]{36}\\.jpg")) {
      throw new IllegalArgumentException("사진 키가 올바르지 않습니다.");
    }
  }
}
