// utils.js

/**
 * Utility: Calculate Intersection over Union (IoU) between two bounding boxes.
 * Boxes are in the format [x1, y1, x2, y2].
 * @param {number[]} boxA - First bounding box.
 * @param {number[]} boxB - Second bounding box.
 * @returns {number} The IoU value (0 to 1).
 */
export function iou(boxA, boxB) {
  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;

  // determine the coordinates of the intersection rectangle
  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  // compute the area of intersection rectangle
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;

  // compute the area of both the prediction and ground-truth rectangles
  const areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);

  // compute the intersection over union by taking the intersection
  // area and dividing it by the sum of prediction + ground-truth
  // areas - the intersection area
  const union = areaA + areaB - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Optional dedupe: keep highest-confidence detection among overlapping same-class boxes.
 * This is a Non-Maximum Suppression (NMS) equivalent.
 * @param {Array<Object>} dets - Array of detection objects { bbox, class, confidence }.
 * @param {number} [iouThreshold=0.45] - IoU threshold for overlap.
 * @returns {Array<Object>} The de-duplicated list of detections.
 */
export function dedupeDetections(dets, iouThreshold = 0.45) {
  const out = [];
  // Sort detections by confidence, descending
  const sorted = [...dets].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  for (const d of sorted) {
    // Normalize box to [x1,y1,x2,y2]
    const box = Array.isArray(d.bbox) && Array.isArray(d.bbox[0]) ? d.bbox[0] : d.bbox;
    let keep = true;

    for (const o of out) {
      const obox = Array.isArray(o.bbox) && Array.isArray(o.bbox[0]) ? o.bbox[0] : o.bbox;
      // Check for overlap with already kept boxes of the same class
      if (d.class === o.class && iou(box, obox) > iouThreshold) {
        keep = false; // Overlaps with a higher-confidence box, so discard
        break;
      }
    }
    if (keep) out.push(d); // Keep this box
  }
  return out;
}