use ab_glyph::{Font, FontRef, ScaleFont};
use image::GenericImage;
use image::{ImageBuffer, ImageFormat, Rgba, RgbaImage};
use imageproc::drawing::draw_filled_rect_mut;
use imageproc::drawing::draw_text_mut;
use imageproc::drawing::text_size;
use imageproc::rect::Rect;
use once_cell::sync::Lazy;
use std::io::Cursor;
use std::sync::Mutex;
use wasm_bindgen::prelude::*;
use web_sys::console;

macro_rules! log {
    ($($t:tt)*) => (console::log_1(&format!("rust: {}", format!($($t)*)).into()));
}

const OUTLINE_SIZE: f32 = 0.02;
const TEXT_PADDING: f32 = 0.01;
const COLOR_TEXT: Rgba<u8> = Rgba([255, 255, 255, 255]);
const COLOR_OUTLINE: Rgba<u8> = Rgba([0, 0, 0, 255]);
const COLOR_TRANSPARENT: Rgba<u8> = Rgba([0, 0, 0, 0]);

static FONT: Lazy<Mutex<Vec<u8>>> = Lazy::new(|| Mutex::new(Vec::new()));
static IMAGE: Lazy<Mutex<RgbaImage>> = Lazy::new(|| Mutex::new(RgbaImage::new(0, 0)));

#[wasm_bindgen]
pub fn set_font(font_bytes: Vec<u8>) {
    log!("set_font: size: {}", font_bytes.len());

    let mut font = match FONT.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            log!("set_font: mutex poisoned, recovering");
            // Still access potentially inconsistent data.
            poisoned.into_inner()
        }
    };

    // Clear the `Vec<u8>` vector first.
    font.clear();

    // Replace the font data.
    *font = font_bytes;
}

#[wasm_bindgen]
pub fn set_image(image_bytes: Vec<u8>) -> Result<(), String> {
    log!("set_image: size: {}", image_bytes.len());

    // Guess image format.
    let format = image::guess_format(&image_bytes)
        .or_else(|err| Err(format!("set_image: failed to guess format: {}", err)))?;
    log!("set_image: image format: {:?}", format);

    // Create a Cursor to read from the Uint8Array without copying data.
    let cursor = Cursor::new(image_bytes);
    log!("set_image: cursor created");

    // Load the image from the cursor.
    let img = image::load(cursor, format)
        .or_else(|err| Err(format!("set_image: failed to load image: {}", err)))?;
    log!("set_image: image loaded");

    // TODO: need this to modify individual pixel colors?
    let new_img = img.to_rgba8();
    log!("set_image: image converted to rgba8");

    // Do not panic.
    let mut img = match IMAGE.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            log!("set_image: mutex poisoned, recovering");
            // Still access potentially inconsistent data.
            poisoned.into_inner()
        }
    };

    // Replace the img data.
    *img = new_img;

    Ok(())
}

// TODO: make to accept Uint8Array only.
// TODO: make to return Uint8Array only.
#[wasm_bindgen]
pub fn draw_image(
    text_top: &str,
    text_bottom: &str,
    font_size: f32,
    stripe_count: u32,
    stripe_height_percent: u32,
) -> Result<Vec<u8>, String> {
    log!("start...");
    log!("params: text_top: {}", text_top);
    log!("params: text_bottom: {}", text_bottom);
    log!("params: font_size: {}", font_size);
    log!("params: stripe_count: {}", stripe_count);
    log!("params: stripe_height_percent: {}", stripe_height_percent);

    let image_lock = IMAGE
        .lock()
        .or_else(|err| Err(format!("draw_image: failed to lock img mutex: {}", err)))?;
    if image_lock.is_empty() {
        return Err("draw_image: loaded image is empty".to_string());
    }
    log!(
        "image loaded: width:{}, height:{}",
        image_lock.width(),
        image_lock.height()
    );

    // Clone the original image from the lock.
    let mut img = RgbaImage::new(image_lock.width(), image_lock.height());
    // The fist argument, `&*image_lock` is the reference to the inner
    // `RgbaImage` dereferenced from `MutexGuard`.
    img.copy_from(&*image_lock, 0, 0)
        .or_else(|err| Err(format!("draw_image: failed to copy image data: {}", err)))?;
    log!("image copied");

    // Drawing stripes.
    draw_transparent_stripes_mut(&mut img, stripe_count, stripe_height_percent);
    log!("stripes drawn");

    expand_and_draw_text_mut(&mut img, text_top, text_bottom, font_size)
        .or_else(|err| Err(format!("draw_image: {}", err)))?;
    log!("text added");

    // Create a Cursor to write the image to a buffer
    let mut result_buffer = Vec::new();
    let mut result_cursor = Cursor::new(&mut result_buffer);
    log!("result cursor created");

    // Write the modified image to the cursor.
    // TODO: extra heavy.
    img.write_to(&mut result_cursor, ImageFormat::Png)
        .or_else(|err| {
            Err(format!(
                "draw_image: failed to write image to buffer: {}",
                err
            ))
        })?;
    log!("png written");

    Ok(result_buffer)
}

fn draw_transparent_stripes_mut(
    img: &mut RgbaImage,
    stripe_count: u32,
    stripe_height_percent: u32,
) {
    if stripe_height_percent <= 0
        || stripe_height_percent >= 100
        || stripe_count <= 0
        || stripe_count > img.height() / 2
    {
        return;
    }

    // Absolute heights of the stripes with image data and transparent stripes.
    let mut stripe_height = ((img.height() / stripe_count) * stripe_height_percent) / 100;
    let mut transparent_height =
        ((img.height() / stripe_count) * (100 - stripe_height_percent)) / 100;

    if stripe_height == 0 {
        stripe_height = 1;
    }
    if transparent_height == 0 {
        transparent_height = 1;
    }

    if stripe_height == 0 || transparent_height == 0 {
        return;
    }

    // TODO: cut the last stripe off (different height)?
    let mut y = stripe_height;
    while y < img.height() {
        draw_filled_rect_mut(
            img,
            Rect::at(0, y as i32).of_size(img.width(), transparent_height),
            COLOR_TRANSPARENT,
        );
        y += stripe_height + transparent_height;
    }
}

fn expand_and_draw_text_mut(
    img: &mut RgbaImage,
    text_top: &str,
    text_bottom: &str,
    font_size: f32,
) -> Result<(), String> {
    if text_top.len() == 0 && text_bottom.len() == 0 {
        return Ok(());
    }

    let font_lock = FONT.lock().or_else(|err| {
        Err(format!(
            "expand_and_draw_text_mut: failed to lock font mutex: {}",
            err
        ))
    })?;
    if font_lock.is_empty() {
        return Err("expand_and_draw_text_mut: font is empty".to_string());
    }
    log!("font loaded");

    let font = FontRef::try_from_slice(&font_lock).or_else(|err| {
        Err(format!(
            "expand_and_draw_text_mut: failed to create font: {}",
            err
        ))
    })?;
    log!("font created");

    // Calculate text height to expand the image.
    let sample_text = if text_top.len() > 0 {
        text_top
    } else {
        text_bottom
    };
    let font_size_adjusted = (std::cmp::max(img.width(), img.height()) as f32) * font_size / 345.0;
    let (_, text_height) = text_size(font_size_adjusted, &font, sample_text);
    log!("text height: {}", text_height);

    // Padding is 1% of the smallest dimension.
    let padding = ((std::cmp::min(img.width(), img.height()) as f32) * TEXT_PADDING) as i32;
    log!("padding: {}", padding);

    // Outline is 2% of the text height.
    let outline_size = std::cmp::min(1, ((text_height as f32) * OUTLINE_SIZE) as i32);
    log!("outline_size: {}", outline_size);

    // Expand image on top and bottom for texts if present.
    let expand_top = if text_top.len() > 0 {
        text_height + 2 * outline_size as u32 + padding as u32
    } else {
        0
    };
    let expand_bottom = if text_bottom.len() > 0 {
        text_height + 2 * outline_size as u32 + padding as u32
    } else {
        0
    };

    expand_image_mut(img, expand_top, expand_bottom);
    log!(
        "image resized: top:{}, bottom:{}",
        expand_top,
        expand_bottom,
    );

    if text_top.len() > 0 {
        draw_spaced_text_with_outline_mut(
            img,
            outline_size,
            0, // y
            font_size_adjusted,
            padding,
            &font,
            text_top,
        );
    }

    if text_bottom.len() > 0 {
        let y = (img.height() - text_height) as i32;
        draw_spaced_text_with_outline_mut(
            img,
            outline_size,
            y,
            font_size_adjusted,
            padding,
            &font,
            text_bottom,
        );
    }

    Ok(())
}

fn expand_image_mut(img: &mut RgbaImage, top: u32, bottom: u32) {
    let expanded_img = ImageBuffer::from_fn(img.width(), top + img.height() + bottom, |x, y| {
        if y < top {
            Rgba([0, 0, 0, 0])
        } else if x < img.width() && y - top < img.height() {
            *img.get_pixel(x, y - top)
        } else {
            Rgba([0, 0, 0, 0])
        }
    });

    *img = expanded_img;
}

fn draw_spaced_text_with_outline_mut(
    img: &mut RgbaImage,
    outline_size: i32,
    y: i32,
    scale: f32,
    padding: i32,
    font: &FontRef,
    text: &str,
) {
    // TODO: adjust text size.
    let (text_width, text_height) = text_size(scale, font, text);

    // x
    let mut x: i32;
    let mut letter_spacing: i32 = 0;
    if text.len() == 1 {
        // Just center this one letter.
        x = (img.width() / 2 - text_width / 2) as i32;
    } else {
        // Make even spacing between the letters (can be negative).
        let available_text_width = img.width() as i32 - padding * 2;
        letter_spacing = (available_text_width - text_width as i32) / (text.len() as i32 - 1);
        x = padding;
    }

    // y
    let y_top =
        y - font.as_scaled(scale).ascent().ceil() as i32 + text_height as i32 + outline_size;

    for (i, char) in text.char_indices() {
        let char_str = &text[i..i + char.len_utf8()];
        draw_text_with_outline_mut(img, outline_size, x, y_top, scale, font, char_str);
        let (char_width, _) = text_size(scale, font, char_str);
        x += letter_spacing + (char_width as i32);
    }
}

// TODO: draw in circle around the actual text.
fn draw_text_with_outline_mut(
    img: &mut RgbaImage,
    outline_size: i32,
    x: i32,
    y: i32,
    scale: f32,
    font: &FontRef,
    text: &str,
) {
    // Draw outline.
    // TODO: min 1, calculate by scale
    let o = outline_size;
    let offsets = [
        (-o, -o),
        (-o, 0),
        (-o, o),
        (0, -o),
        (0, o),
        (o, -o),
        (o, 0),
        (o, o),
    ];
    for (dx, dy) in &offsets {
        draw_text_mut(img, COLOR_OUTLINE, x + dx, y + dy, scale, font, text);
    }

    // Draw text.
    draw_text_mut(img, COLOR_TEXT, x, y, scale, font, text);
}
