(function(){
  const U=FinUtils;
  const txs=(p,type=null)=>p.transactions.filter(t=>!type||t.type===type);
  const inPeriod=(t,period,now=new Date())=>new Date(t.datetime)>=U.periodStart(period,now) && new Date(t.datetime)<=now;
  const total=(p,{type,period='all',categoryId=null,merchant=null}={})=>txs(p,type).filter(t=>inPeriod(t,period)&&(!categoryId||t.categoryId===categoryId)&&(!merchant||t.merchant===merchant)).reduce((s,t)=>s+Number(t.amount||0),0);
  const categorySummary=(p,type='expense',period='month')=>p.categories.filter(c=>c.type===type).map(c=>({category:c,spent:total(p,{type,period,categoryId:c.id}),remaining:type==='expense'?(Number(c.budget)||0)-total(p,{type,period,categoryId:c.id}):0}));
  const merchantSummary=(p,period='month')=>{
    const map={}; txs(p,'expense').filter(t=>inPeriod(t,period)).forEach(t=>{const k=t.merchant||'Без места';map[k]=(map[k]||0)+Number(t.amount||0)}); return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  };
  const totalBudget=p=>p.categories.filter(c=>c.type==='expense').reduce((s,c)=>s+(Number(c.budget)||0),0);
  window.FinStats={total,categorySummary,merchantSummary,totalBudget,inPeriod};
})();
