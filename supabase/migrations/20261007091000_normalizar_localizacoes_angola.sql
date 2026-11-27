-- Normaliza localizações antigas para a nova divisão político-administrativa de Angola.
-- As alterações são idempotentes e não alteram perfis de outros países.

update public.users
set province_id = 'icolo-e-bengo'
where province_id = 'icolo-bengo';

update public.users
set municipality_id = case
  when province_id = 'cabinda' and municipality_id = 'cabinda-city' then 'cabinda'
  when province_id = 'luanda' and municipality_id in ('luanda', 'luanda-city') then 'ingombota'
  when province_id = 'icolo-e-bengo' and municipality_id = 'icolo-e-bengo' then 'catete'
  when province_id = 'moxico-leste' and municipality_id = 'alto-zambeze' then 'cazombo'
  else municipality_id
end
where (province_id = 'cabinda' and municipality_id = 'cabinda-city')
   or (province_id = 'luanda' and municipality_id in ('luanda', 'luanda-city'))
   or (province_id = 'icolo-e-bengo' and municipality_id = 'icolo-e-bengo')
   or (province_id = 'moxico-leste' and municipality_id = 'alto-zambeze');
