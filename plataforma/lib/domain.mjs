export const STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const SEGMENTS = ['Concreteira', 'Bombeamento de concreto', 'Construtora', 'Locadora'];
export const SIZES = ['Pequeno', 'Médio', 'Grande', 'Não informado'];
export const STATUSES = ['Novo', 'Em contato', 'Qualificado', 'Sem interesse'];
export class AppError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function clean(value, max = 200) { return String(value ?? '').trim().slice(0, max); }
export function slug(value) { return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function url(value) {
  if (!value) return '';
  try { const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw 0; return u.href; }
  catch { throw new AppError('Informe um endereço completo iniciado por https:// ou http://.'); }
}
export function validCnpj(value) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = n => { let sum = 0, weight = n - 7; for (let i = 0; i < n; i++) { sum += (value.charCodeAt(i) - 48) * weight--; if (weight < 2) weight = 9; } const r = sum % 11; return r < 2 ? 0 : 11 - r; };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}
export function companyInput(body) {
  const name = clean(body.name, 160), city = clean(body.city, 100), state = clean(body.state, 2), segment = clean(body.segment, 50), size = clean(body.size, 20) || 'Não informado';
  if (name.length < 2 || city.length < 2 || !STATES.includes(state) || !SEGMENTS.includes(segment) || !SIZES.includes(size)) throw new AppError('Preencha empresa, cidade, estado, segmento e porte corretamente.');
  const cnpj = clean(body.cnpj, 30).toUpperCase().replace(/[.\/\s-]/g, '');
  if (cnpj && !validCnpj(cnpj)) throw new AppError('O CNPJ informado não é válido.');
  const phone = clean(body.phone, 30), whatsapp = clean(body.whatsapp, 30).replace(/\D/g, '');
  if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) throw new AppError('Informe o WhatsApp com 55, DDD e número (12 ou 13 dígitos).');
  const flag = k => body[k] === true || body[k] === 1 || body[k] === '1' ? 1 : body[k] === false || body[k] === 0 || body[k] === '0' ? 0 : null;
  const sourceUrl = url(body.sourceUrl);
  if (!sourceUrl) throw new AppError('Adicione a fonte pública usada para verificar a empresa.');
  return { name, city, state, segment, size, cnpj: cnpj || null, phone, whatsapp, website: url(body.website), sourceUrl, structure: clean(body.structure, 3000), pumping: flag('pumping'), fleet: flag('fleet'), branches: flag('branches'), identity: `${slug(name)}:${slug(city)}:${state}` };
}
export function scoreCompany(c) {
  const reasons = [
    { label: 'Segmento de atuação', points: c.segment === 'Concreteira' ? 25 : c.segment === 'Bombeamento de concreto' ? 30 : 15, max: 30 },
    { label: 'Porte da empresa', points: c.size === 'Grande' ? 20 : c.size === 'Médio' ? 12 : c.size === 'Pequeno' ? 5 : 0, max: 20 },
    { label: 'Trabalha com bombeamento', points: c.pumping === 1 ? 25 : 0, max: 25 },
    { label: 'Possui frota própria', points: c.fleet === 1 ? 15 : 0, max: 15 },
    { label: 'Possui várias unidades', points: c.branches === 1 ? 10 : 0, max: 10 },
  ];
  const score = reasons.reduce((sum, r) => sum + r.points, 0);
  return { score, priority: score >= 75 ? 'A' : score >= 45 ? 'B' : 'C', reasons, unknown: [c.pumping, c.fleet, c.branches].filter(v => v == null).length + (c.size === 'Não informado' ? 1 : 0) };
}
