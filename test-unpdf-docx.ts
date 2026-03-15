import { extractText } from 'unpdf';

async function test() {
  const buffer = Buffer.from('PK\x03\x04\x14\x00\x06\x00\x08\x00\x00\x00!\x00\xdf\xa4\xd2lZ\x01\x00\x00 \x05\x00\x00\x13\x00\x08\x02[Content_Types].xml');
  
  try {
    const data = await extractText(new Uint8Array(buffer));
    console.log("Success:", data.text);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
