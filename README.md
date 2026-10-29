# Forever Memories Travel preview

This is a second copy of the public site so Jennifer can compare it with the current site. It is served from this repository on GitHub Pages at https://preview.forevermemoriestravel.com.

The current site stays at https://forevermemoriestravel.com from CiscoKidRy/forever-memories-travel. Do not publish this preview onto that repository, the apex, or www.

## Design

The layout follows the Canva page Jennifer sent on 28 Oct 2026. The attachment was a PNG named Forever_Memories_Canva_Photo_Layers.pptx.png, not a PDF. Photos and the luggage-tag mark are crops of that file. The crop boxes are in assets/design/CROPS.txt. The original PNG is not in this repository.

The script word “Memories” is Cormorant Garamond italic. The font file shipped here is the roman weight 500 file, and the browser draws the italic. The hero heading is fixed HTML so a CMS text update does not flatten that word.

Journal and FAQ pages say the articles and questions were not in the design file. Meet Jennifer uses the two welcome paragraphs and “Hi, I’m Jennifer!” from the design. All-inclusive and celebrations pages use only the card lines. The four existing guides keep their current article text inside this frame.

## Search and analytics

Every preview page sends `noindex, nofollow`. robots.txt is `Disallow: /`. There is no sitemap and no Google tag. The live site’s note that every new hostname uses G-GYBCCKG2FJ does not apply here. Preview traffic must not land in that property.

## Trip form

The form posts to https://preview-inquiries.forevermemoriestravel.com/inquiries. The honeypot control is named fmt_hp. The JSON key remains company. Trip values remain Family vacation, Theme park, Cruise, International, and Not sure yet.

The preview inquiry service stores the row in forever_memories_preview and does not send email. The live database forever_memories and the live API on inquiries.forevermemoriestravel.com are separate.

## CMS

Page copy is edited in the preview Worker fmt-admin-preview, bound to D1 database fmt-admin-preview (093bfa2d-b51b-43d6-bd8d-707313693600). Publish stays unconfigured until a fine-grained GitHub token exists for this repository only. Do not install the live repository token or a broad token as a Worker secret.

Listing categories on the preview include family, park, cruise, international, all-inclusive, and celebration. Those last two categories are preview-only.

## Fonts

Cormorant Garamond and Nunito Sans are the SIL Open Font License files in assets/fonts. See the OFL text files there.
