let batch=0;
export function generatedFixture(){const n=++batch;return Array.from({length:5},(_,i)=>({name:String.fromCodePoint(0x4e00+n*8+i).repeat(5),category:'测试',minutes:15+i*5,content:String.fromCodePoint(0x6000+n*8+i).repeat(45)}));}
