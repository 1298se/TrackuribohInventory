export function getLargeTCGPlayerImage({
  imageUrl,
  size = 400,
}: {
  imageUrl: string;
  size?: 200 | 400 | 600 | 800 | 1000;
}) {
  // Extract product number from tcgplayer_url like "tcgplayer-cdn.tcgplayer.com/product/215158_200w.jpg"
  const productNumber = imageUrl.match(/\/product\/(\d+)_200w\.jpg/)?.[1];

  console.log(productNumber);

  if (!productNumber) return imageUrl; // fallback to original URL

  return `https://tcgplayer-cdn.tcgplayer.com/product/${productNumber}_in_${size}x${size}.jpg`;
}
