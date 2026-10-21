/* Catalogue entry for the free QR Code to STL tool. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'qr-code',
  name: 'QR Code to STL',
  short: 'Wi-Fi, UPI, WhatsApp or website QR codes as two-colour printable plates.',
  lede: 'Type a Wi-Fi password, a UPI ID, a WhatsApp number or a web address and get a 3D printable QR code: a plate and a raised code as two STL files, with a label, rounded corners, a keychain ring or a round coaster shape.',
  status: 'live',
  makePath: '/tools/qr-code/make',
  index: '14',
  image: '/images/hero-qr-code.jpg',
  free: true,
  slide: { title: 'Scan it, print it.', lede: 'Wi-Fi, UPI and WhatsApp codes as two-colour plates, keychains and coasters. Free, made in your browser.' },
  youGet: [
    'Two STL files: the plate and the raised code (with an optional label)',
    'Wi-Fi, UPI payment, WhatsApp, website, contact card, phone, email or text',
    'Rounded, square, keychain or round coaster shapes',
    'A flat PNG of the same code to test the scan first',
    'Print notes, including where to change filament on a single-nozzle printer',
  ],
  steps: [
    { title: 'Choose what it opens', text: 'A Wi-Fi network, a UPI ID, a WhatsApp chat, a website or a contact card. Nothing you type leaves your browser.' },
    { title: 'Shape the plate', text: 'Size, thickness, corners, a label under the code, and a keychain ring or round coaster if you like. Check the scan on screen.' },
    { title: 'Download and print', text: 'Two STLs for two colours. On a single-nozzle printer, change filament at the height shown.' },
  ],
  specsTitle: 'The plate',
  specs: [
    ['Code size', '20 to 150 mm wide'],
    ['Shapes', 'Rounded, square, keychain with ring hole, round coaster'],
    ['Thickness', 'Plate 0.8 to 6 mm, code 0.4 to 3 mm'],
    ['Files', 'Two binary STLs, a PNG and print notes in a zip'],
    ['Price', 'Free, no account'],
  ],
  faq: [
    { q: 'Will a 3D printed QR code scan?', a: 'Yes, as long as the two colours contrast well (black on white is best) and each square is at least about 1.2 mm with a 0.4 mm nozzle. The tool warns you when the squares get too small, and shows a flat version you can test with your phone first.' },
    { q: 'How do I print it in two colours with one nozzle?', a: 'Print the plate and code together and pause for a filament change at the height shown under the preview (the plate thickness). Most slicers let you add a colour change at a layer by right-clicking the layer slider.' },
    { q: 'Can I make a Wi-Fi QR code?', a: 'Yes. Type the network name and password; phones that scan it join the network without typing. The password is inside the code, so anyone who scans it can join.' },
    { q: 'Can I make a UPI payment QR code?', a: 'Yes. Type your UPI ID and the name to show. You can fix an amount or let the payer type it. It works with Google Pay, PhonePe, Paytm and BHIM.' },
    { q: 'Is it free?', a: 'Yes, completely free with no account. The files are made in your browser and you can use and sell what you print.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'QR Code to STL (Free) – 3D Printable Wi-Fi, UPI & WhatsApp QR Codes',
  description: 'Free QR code STL generator: Wi-Fi, UPI, WhatsApp, website and contact QR codes as two-colour 3D printable plates, keychains and coasters, with a label. Made in your browser.',
  keywords: ['qr code stl', 'qr code to stl', '3d printed qr code', 'wifi qr code stl', 'upi qr code 3d print', 'qr code keychain', 'qr code coaster stl', 'free qr code 3d model'],
};
