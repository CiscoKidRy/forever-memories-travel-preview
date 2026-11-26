-- Preview database only. Do not apply this to forever_memories.
alter table inquiries drop constraint inquiries_source_url;
alter table inquiries add constraint inquiries_source_url
  check (char_length(source_url) between 1 and 500
    and (source_url ~ '^https://preview\.forevermemoriestravel\.com(/[^[:space:]]*)?$'
      or source_url ~ '^https://forevermemoriestravel\.com/test(/[^[:space:]]*)?$'));
