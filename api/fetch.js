const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function api() {
  const url = 'http://localhost:3000/items';
  const payload = {
    "id": "10",
    'name': 'new item'
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    console.log(data);
    

  } catch (error) {
    console.error(error);
  }
}


async function main()
{
  await api();
}

main();

