function chooseSamplePages(details){
 const topics=[[/قطار|مغامر|أحافير|ديناصور/,'archaeologist'],[/طائر|طيران|ورقي/,'kite'],[/اختراع|روبوت|صنع/,'inventor'],[/خبز|مخبز|طبخ|حلوى/,'baker'],[/حديق|زرع|طبيع/,'gardener'],[/مسرح|دمى|حكاي/,'puppeteer']];
 return [...new Set([...topics.filter(([pattern])=>pattern.test(details||'')).map(([,page])=>page),'inventor','baker'])].slice(0,2).map(page=>'assets/coloring-'+page+'.webp');
}
