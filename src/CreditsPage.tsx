import credits from './lib/tileCredits.json'

export function CreditsPage() {
  return (
    <section className="card">
      <h2>Credits <span>Art and licence</span></h2>
      <p>Tile faces are cropped from the Wikimedia Commons set “SVG Oblique illustrations of Mahjong tiles”, CC BY-SA 4.0, drawn by Cangjie6 and other contributors. The oblique side and top were removed and Adobe Illustrator metadata was stripped. Scoring uses only the painted face.</p>
      <p>Flower order follows the painted numbers 梅蘭菊竹 and 春夏秋冬, not the Unicode Mahjong block order.</p>
      <ul>
        {(credits as { id: string; page: string; description: string; artist: string }[]).slice(0, 8).map((item) => (
          <li key={item.id}><a href={item.page}>{item.id}</a> — {item.description} {item.artist}</li>
        ))}
      </ul>
      <p className="muted">{(credits as unknown[]).length} adapted tiles. Full list is in src/lib/tileCredits.json. Share-alike applies to the adapted SVGs.</p>
    </section>
  )
}
