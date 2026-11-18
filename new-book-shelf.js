/* Standalone reader-shelf actions for the two books added in November 2026.
   Does not replace the existing site's book-actions.js on older pages. */
(async function(){
  'use strict';
  const root=document.getElementById('bookActionPanel');
  if(!root)return;
  const loading=document.getElementById('bookActionLoading');
  const login=document.getElementById('bookActionLogin');
  const form=document.getElementById('bookActionForm');
  const status=document.getElementById('bookActionStatus');
  const read=document.getElementById('bookActionRead');
  const rating=document.getElementById('bookActionRating');
  const review=document.getElementById('bookActionReview');
  const save=document.getElementById('bookActionSave');
  const message=document.getElementById('bookActionMessage');
  const ids=(root.dataset.bookAliases||root.dataset.bookId).split(',').map(x=>x.trim()).filter(Boolean);
  const primary=ids[0];
  const updateRead=()=>{read.hidden=status.value!=='read'};
  status.addEventListener('change',updateRead);
  if(!window.supabase){loading.textContent='Не удалось загрузить авторизацию. Обнови страницу.';return}
  const client=window.supabase.createClient('https://ucdbshgntaqtojsuzvqb.supabase.co','sb_publishable_4MG1e0_NkmBoFfV4o6-v4g_oAAeeDfv');
  let user=null,existing=null,recordId=primary;
  try{
    const result=await client.auth.getUser();
    user=result.data?.user||null;
    if(!user){loading.hidden=true;login.hidden=false;return}
    const {data,error}=await client.from('user_books').select('id,book_id,status').eq('user_id',user.id).in('book_id',ids);
    if(error)throw error;
    existing=(data||[]).find(r=>r.book_id===primary)||(data||[])[0]||null;
    if(existing){recordId=existing.book_id;status.value=existing.status||''}
    const [ratingResult,reviewResult]=await Promise.all([
      client.from('book_ratings').select('book_id,rating').eq('user_id',user.id).in('book_id',ids),
      client.from('book_reviews').select('book_id,review_text').eq('user_id',user.id).in('book_id',ids)
    ]);
    if(!ratingResult.error){const row=(ratingResult.data||[]).find(r=>r.book_id===recordId)||ratingResult.data?.[0];if(row)rating.value=String(row.rating)}
    if(!reviewResult.error){const row=(reviewResult.data||[]).find(r=>r.book_id===recordId)||reviewResult.data?.[0];if(row)review.value=row.review_text||''}
    updateRead();loading.hidden=true;form.hidden=false;
  }catch(err){loading.textContent='Не удалось загрузить читательскую запись: '+(err?.message||'попробуй позже');return}
  save.addEventListener('click',async()=>{
    if(!user)return;
    const desired=status.value;
    if(desired==='read'&&rating.value===''){message.textContent='Чтобы оценить прочитанную книгу, выбери оценку от 1 до 10.';return}
    if(review.value.trim()&&rating.value===''){message.textContent='Для публикации рецензии нужна оценка.';return}
    save.disabled=true;message.textContent='Сохраняем…';
    try{
      if(!desired){
        if(existing){const {error}=await client.from('user_books').delete().eq('id',existing.id).eq('user_id',user.id);if(error)throw error;existing=null}
        message.textContent='Книга убрана с полки.';
      }else{
        if(existing){const {error}=await client.from('user_books').update({status:desired}).eq('id',existing.id).eq('user_id',user.id);if(error)throw error}
        else{const {data,error}=await client.from('user_books').upsert({user_id:user.id,book_id:primary,status:desired},{onConflict:'user_id,book_id'}).select('id,book_id,status').single();if(error)throw error;existing=data;recordId=data.book_id}
        if(desired==='read'&&rating.value){const {error}=await client.from('book_ratings').upsert({user_id:user.id,book_id:recordId,rating:Number(rating.value)},{onConflict:'user_id,book_id'});if(error)throw error}
        if(desired==='read'&&review.value.trim()){
          const {error}=await client.from('book_reviews').upsert({user_id:user.id,book_id:recordId,review_text:review.value.trim(),display_name:user.user_metadata?.display_name?.trim()||'Читатель'},{onConflict:'user_id,book_id'});
          if(error)throw error;
        }
        message.textContent='Сохранено. Книга теперь на твоей полке.';
      }
    }catch(err){message.textContent='Ошибка сохранения: '+(err?.message||'попробуй позже')}
    finally{save.disabled=false}
  });
})();
