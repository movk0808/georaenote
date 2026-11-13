-- 회원 탈퇴 시 앱·웹이 본인이 올린 증빙 파일을 먼저 지울 수 있게 본인 폴더 삭제 권한을 줍니다.
create policy proofs_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
