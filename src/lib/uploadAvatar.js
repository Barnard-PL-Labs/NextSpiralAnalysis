//SHIFTED EVERYTHING INSIDE SETTING PAGE
// import { supabase } from './supabaseClient';

// export async function uploadAvatar(file, user) {
//   if (!user || !user.id) throw new Error("User not authenticated");

//   const fileExt = file.name.split('.').pop();
//   const filePath = `${user.id}/avatar.${fileExt}`;

//   const { error } = await supabase.storage
//     .from('avatars')
//     .upload(filePath, file, {
//       upsert: true,
//       cacheControl: '3600',
//       contentType: file.type,
//     });

//   if (error) throw error;

//   const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
//   return data.publicUrl;
// }
