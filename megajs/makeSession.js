const axios = require("axios");
const token = "c861c4509789d59ba33c8855c72dfb44957df4cf95f9efb4c5c91ba9126706c08ebea8fc87e14901c8f147da32967160d790f93c77558cfbdfe97904b01be486";
async function create(data) {
  try { const config = {
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
