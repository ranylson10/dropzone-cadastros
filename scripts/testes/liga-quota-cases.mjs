/** Same raw JSON fixtures for the operational helper and the native PostgreSQL suite. */
export const ligaQuotaCases = [
 ...['1.5','1.0','-1','NaN','Infinity','1e2','0x10','+2','',' ','2x','9007199254740992','9'.repeat(100)].map(quantity=>({name:'invalid string '+JSON.stringify(quantity),entries:[{tipo:'vaga_paga',quantidade:quantity}],valid:false})),
 ...[1.5,-1,9007199254740992,true,false,null,{},[],[2]].map(quantity=>({name:'invalid JSON '+JSON.stringify(quantity),entries:[{tipo:'vaga_paga',quantidade:quantity}],valid:false})),
 {name:'missing quantity',entries:[{tipo:'vaga_paga'}],valid:false},
 {name:'unknown origin',entries:[{tipo:'other',quantidade:'1'}],valid:false},
 {name:'array origin',entries:[{tipo:['vaga_paga'],quantidade:'1'}],valid:false},
 {name:'null entry',entries:[null],valid:false},
 {name:'invalid unselected origin',entries:[{tipo:'vaga_paga',quantidade:'1'},{tipo:'mantida',quantidade:'1.5'}],valid:false},
 {name:'overflow selected sum',entries:[{tipo:'vaga_paga',quantidade:'9007199254740991'},{tipo:'vaga_paga',quantidade:'1'}],valid:false},
 {name:'overflow unselected sum',entries:[{tipo:'vaga_paga',quantidade:'1'},{tipo:'mantida',quantidade:'9007199254740991'},{tipo:'mantida',quantidade:'1'}],valid:false},
 ...[1,'1',' 1 ','\t1\n','0001','0'.repeat(100)+'1','9007199254740991',9007199254740991].map(quantity=>({name:'valid integer '+JSON.stringify(quantity),entries:[{tipo:'vaga_paga',quantidade:quantity}],valid:true,quota:Number(quantity)})),
 {name:'same origin summed',entries:[{tipo:'vaga_paga',quantidade:'1'},{tipo:'vaga_paga',quantidade:1}],valid:true,quota:2},
 {name:'unselected zero quota',entries:[{tipo:'vaga_paga',quantidade:'1'},{tipo:'mantida',quantidade:'0'}],valid:true,quota:1},
]
