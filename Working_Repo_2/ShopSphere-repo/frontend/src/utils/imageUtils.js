/**
 * Image URL utility for consistent product image rendering
 * Handles JSON string parsing and URL prefixing
 */

/**
 * Parse product.images which may be stored as JSON string in database
 * @param {any} images - Could be array, JSON string, or undefined
 * @returns {string[]} Array of relative image paths like ["/uploads/file.jpg"]
 */
export function parseProductImages(images) {
  if (!images) return []
  
  // If it's a string, try to parse as JSON
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      return Array.isArray(parsed) ? parsed : []
    } catch (err) {
      // If parsing fails, treat as single image path (allow filenames like "file.png")
      return images ? [images] : []
    }
  }
  
  // If it's already an array, return it
  if (Array.isArray(images)) {
    return images.filter(img => typeof img === 'string')
  }
  
  return []
}

/**
 * Get the correct public URL for a product image
 * @param {string} imagePath - Relative path like "/uploads/file.jpg" or full path
 * @param {boolean} isTemporary - If true, image is temporary (blob URL from form), don't prepend backend URL
 * @returns {string} Full public URL like "http://localhost:4000/uploads/file.jpg" or placeholder
 */
export function getImageUrl(imagePath, isTemporary = false) {
  // Resolve various stored formats into a full public URL
  if (!imagePath) return '/placeholder.png'

  if (isTemporary || (typeof imagePath === 'string' && imagePath.startsWith('blob:'))) {
    return imagePath
  }

  if (typeof imagePath === 'string' && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
    return imagePath
  }

  // Determine backend base from env if available
  const BACKEND_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000'

  // If stored with leading /uploads prefix
  if (typeof imagePath === 'string' && imagePath.startsWith('/uploads')) {
    return `${BACKEND_BASE}${imagePath}`
  }

  // If stored as a path starting with slash (other paths), prepend backend base
  if (typeof imagePath === 'string' && imagePath.startsWith('/')) {
    return `${BACKEND_BASE}${imagePath}`
  }

  // Otherwise assume it's a bare filename and place under /uploads
  return `${BACKEND_BASE}/uploads/${imagePath}`
}

/**
 * Get image source for rendering, with proper URL formatting
 * @param {any} productImages - Raw product.images from API
 * @param {number} index - Which image to get (default 0 for first)
 * @returns {string} Full URL for img src attribute
 */
export function getProductImageUrl(productImages, index = 0) {
  const images = parseProductImages(productImages)
  if (images.length === 0 || !images[index]) {
    return '/placeholder.png'
  }
  return getImageUrl(images[index], false)
}
