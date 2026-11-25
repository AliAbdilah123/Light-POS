const base = process.env.POS_URL || 'http://127.0.0.1:8103'
const password = process.env.POS_PASSWORD
if (!password) throw new Error('POS_PASSWORD is required')

const items = [
  ['Bubur Mandarin Ayam', 'Cakwe, kerupuk pangsit, jamur kuping/shiitake, ayam suwir, daun bawang, minyak bawang, dan daun cilantro. Recommended.', 'Food', 23000],
  ['Bubur Mandarin Udang', 'Cakwe, kerupuk pangsit, jamur kuping/shiitake, udang, daun bawang, minyak bawang, dan daun cilantro.', 'Food', 18000],
  ['Bubur Mandarin Ayam Charsiu', 'Cakwe, kerupuk pangsit, jamur kuping/shiitake, ayam charsiu, daun bawang, minyak bawang, dan daun cilantro.', 'Food', 23000],
  ['Siomay Kukus', 'Siomay isi 5. Recommended.', 'Savory', 20000],
  ['Batagor Spesial (ayam ikan)', 'Batagor 3, tahu 2, dan kentang.', 'Savory', 20000],
  ['Ubee Brulee', '', 'Sweet', 21000],
  ['French Toast', 'Recommended.', 'Sweet', 19000],
  ['Banana Chesse Brulee', 'Recommended.', 'Sweet', 18000],
  ['Ketan Hitam Ice Cream', '', 'Sweet', 18000],
  ['Cendol Ice Cream', '', 'Sweet', 18000],
  ['Jagung Ketan Pisang Creamy', '', 'Sweet', 20000],
].map(([name, description, category, price]) => ({ name, description, category, price }))

const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin.cilong99', password }) })
const auth = await login.json()
if (!login.ok) throw new Error(`Login failed (${login.status}): ${JSON.stringify(auth)}`)
const cookie = login.headers.get('set-cookie')?.split(';')[0]
const response = await fetch(`${base}/api/menu?business=cilong99`, { method: 'POST', headers: { cookie, 'x-csrf-token': auth.user.csrfToken, 'content-type': 'application/json' }, body: JSON.stringify(items) })
const result = await response.json()
if (!response.ok) throw new Error(`Import failed (${response.status}): ${JSON.stringify(result)}`)
console.log(JSON.stringify(result, null, 2))
