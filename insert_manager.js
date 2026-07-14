const url = 'https://uukivzxabiydnrvjvabt.supabase.co/rest/v1/managers'
const headers = {
  apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6InV1a2l2enhhYml5ZG5ydmp2YWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDI5MzEsImV4cCI6MjA5ODQxODkzMX0.tZIGyK8ZK7j-2FZ_R85bkZawq2TMQj2FW0VhojL6ehk',
  Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg0MjkzMSwiZXhwIjoyMDk4NDE4OTMxfQ.nRpfcwZES7NDia_d3kJq0290pZI6aRvceCOhyg950Ag',
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}
const body = JSON.stringify({
  auth_user_id: 'b8800705-8850-4ec5-8207-34d3166830fa',
  username: 'manager_b8800705',
  nome: 'Manager b8800705',
  email_contato: 'manager-b8800705@example.com',
})

async function run() {
  try {
    const res = await fetch(url, { method: 'POST', headers, body })
    const text = await res.text()
    console.log('status', res.status)
    console.log(text)
  } catch (err) {
    console.error(err)
  }
}
run()
