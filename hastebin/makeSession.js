const axios = require("axios");
const token = "70f80eb3dc8101d1f44be24b28aef7f5fc4d5c9781e4f4866405b9895044773c5b365ea985d28b325ac9403789999ed12a99c4666b9ff21d13122949d1f6fc15";
async function create(data) {
  try { 
    const config = {
      method: 'post',
      url: 'https://hastebin.com/documents',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'  
      },
      data: JSON.stringify({ content: data })  
    }; const res = await axios(config);
    return { id: res.data.key };  
  } catch (error) {
    throw new Error(`${error.message}`);
  }
}

async function get(key) {
  try {
    const config = {
      method: 'get',
      url: `https://hastebin.com/raw/${key}`,
      headers: {
        'Authorization': `Bearer ${token}`
      }};
    const res = await axios(config);
    return res.data
  } catch (error) {
    throw new Error(`${error.message}`);
  }}

module.exports = { create, get };
