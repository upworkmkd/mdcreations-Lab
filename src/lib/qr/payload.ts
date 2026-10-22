/* What goes inside the QR code, for each kind of code. */
export type Kind = 'url' | 'text' | 'wifi' | 'upi' | 'whatsapp' | 'phone' | 'email' | 'contact';
export const KINDS: [Kind, string][] = [
  ['url', 'Website'], ['wifi', 'Wi-Fi'], ['upi', 'UPI payment'], ['whatsapp', 'WhatsApp'],
  ['contact', 'Contact card'], ['text', 'Text'], ['phone', 'Phone'], ['email', 'Email'],
];
export type Fields = Record<string, string>;

const wifiEsc = (s: string) => s.replace(/([\;,:"])/g, '\\$1');
const digits = (s: string) => s.replace(/[^\d+]/g, '');

export function payload(kind: Kind, f: Fields): { text: string; error?: string; label: string } {
  const v = (k: string) => (f[k] ?? '').trim();
  switch (kind) {
    case 'url': {
      let u = v('url'); if (!u) return { text: '', error: 'Type a web address.', label: '' };
      if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
      return { text: u, label: u.replace(/^https?:\/\//, '').replace(/\/$/, '') };
    }
    case 'text': return v('text') ? { text: v('text'), label: '' } : { text: '', error: 'Type some text.', label: '' };
    case 'wifi': {
      const ssid = v('ssid'); if (!ssid) return { text: '', error: 'Type the network name.', label: '' };
      const sec = v('security') || 'WPA', pass = f.password ?? '';
      if (sec !== 'nopass' && !pass) return { text: '', error: 'Type the Wi-Fi password, or choose “No password”.', label: '' };
      return { text: `WIFI:T:${sec};S:${wifiEsc(ssid)};${sec !== 'nopass' ? `P:${wifiEsc(pass)};` : ''}${f.hidden === '1' ? 'H:true;' : ''};`, label: `Wi-Fi: ${ssid}` };
    }
    case 'upi': {
      const pa = v('vpa'); if (!/^[\w.\-]{2,}@[a-z][a-z0-9.\-]*$/i.test(pa)) return { text: '', error: 'Type a UPI ID like name@okhdfcbank.', label: '' };
      const q = new URLSearchParams({ pa }); if (v('name')) q.set('pn', v('name'));
      const am = Number(v('amount')); if (v('amount') && !(am > 0)) return { text: '', error: 'The amount should be a number.', label: '' };
      if (am > 0) q.set('am', am.toFixed(2)); q.set('cu', 'INR'); if (v('note')) q.set('tn', v('note'));
      return { text: 'upi://pay?' + q.toString().replace(/\+/g, '%20'), label: v('name') ? `Pay ${v('name')}` : 'Scan to pay' };
    }
    case 'whatsapp': {
      const n = digits(v('phone')).replace(/^\+/, ''); if (n.length < 8) return { text: '', error: 'Type the WhatsApp number with country code, like 91 98765 43210.', label: '' };
      return { text: `https://wa.me/${n}${v('message') ? `?text=${encodeURIComponent(v('message'))}` : ''}`, label: 'Chat on WhatsApp' };
    }
    case 'phone': { const n = digits(v('phone')); return n.length >= 5 ? { text: `tel:${n}`, label: n } : { text: '', error: 'Type a phone number.', label: '' }; }
    case 'email': {
      const e = v('email'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { text: '', error: 'Type an email address.', label: '' };
      const q = new URLSearchParams(); if (v('subject')) q.set('subject', v('subject')); if (v('body')) q.set('body', v('body'));
      const qs = q.toString().replace(/\+/g, '%20');
      return { text: `mailto:${e}${qs ? '?' + qs : ''}`, label: e };
    }
    case 'contact': {
      const name = v('name'); if (!name) return { text: '', error: 'Type a name.', label: '' };
      const esc = (s: string) => s.replace(/([\;,])/g, '\\$1').replace(/\n/g, '\\n');
      const L = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(name)}`, `N:${esc(name)};;;;`];
      if (v('org')) L.push(`ORG:${esc(v('org'))}`);
      if (v('phone')) L.push(`TEL;TYPE=CELL:${digits(v('phone'))}`);
      if (v('email')) L.push(`EMAIL:${esc(v('email'))}`);
      if (v('url')) L.push(`URL:${esc(v('url'))}`);
      L.push('END:VCARD');
      return { text: L.join('\n'), label: name };
    }
  }
}
