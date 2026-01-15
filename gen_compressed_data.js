
function generateCompressedData() {
    let price = 150.00; // Base Price
    const points = [];
    const gaps = new Set();

    // Add some gaps (e.g., lunch break 12:00-13:00 approx, or random outages)
    // Let's create a few random gaps of 5-10 minutes
    const gapStarts = [100, 250];
    const gapLengths = [15, 10];

    for (let i = 0; i < 390; i++) {
        // Check if in gap
        let isGap = false;
        for (let g = 0; g < gapStarts.length; g++) {
            if (i >= gapStarts[g] && i < gapStarts[g] + gapLengths[g]) {
                isGap = true;
                break;
            }
        }

        if (isGap) {
            points.push('_'); // Gap placeholder
            // Price might still "move" silently or stay same. Let's drift it slightly so line resumes elsewhere
            price += (Math.random() - 0.5) * 0.5;
        } else {
            // Random walk
            const change = (Math.random() - 0.5) * 0.4; // +/- 20 cents
            price += change;
            points.push(price);
        }
    }

    // Compression
    // Format: BasePrice|Diff1,Diff2...
    // Diff = (Current - Prior) * 100 cast to int
    // If current is gap, write '_'
    // If prior was gap, diff is (Current - LastValidPrice) * 100? 
    // Wait, the decompression logic I wrote:
    // if (d === '_') prices.push(null);
    // else { delta = d/100; currentPrice += delta; prices.push(currentPrice); }
    // So distinct from "gap", the "delta" is ALWAYS relative to the `currentPrice` variable in the loop.
    // If I push null, `currentPrice` variable DOES NOT CHANGE in decompression loop.
    // So the next delta is effectively (NextPrice - LastValidPrice).

    const basePrice = points[0];
    const diffs = [];
    let currentCalcPrice = basePrice;

    // Run-Length Encoding for Gaps
    let gapCount = 0;

    for (let i = 1; i < points.length; i++) {
        const val = points[i];
        if (val === '_') {
            gapCount++;
        } else {
            // If we were accumulating gaps, flush them
            if (gapCount > 0) {
                diffs.push(gapCount === 1 ? '_' : `_${gapCount}`);
                gapCount = 0;
            }

            const diff = Math.round((val - currentCalcPrice) * 100);
            diffs.push(diff);
            currentCalcPrice += diff / 100;
        }
    }
    // Flush trailing gaps
    if (gapCount > 0) {
        diffs.push(gapCount === 1 ? '_' : `_${gapCount}`);
    }

    return `${basePrice.toFixed(2)}|${diffs.join(',')}`;
}

console.log(generateCompressedData());
