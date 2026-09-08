//frontend/src/editionAndDeletion/hooks/useLangTranslation.ts
// import {  useMemo } from "react";
import { useCallback } from "react";
import { DictionaryDataType, getLangText, LanguageKeyType, TranslationValuesType, } from "../utils/languages";

// export const useLanguageTranslation = (language:LanguageKeyType)=>{
//  const translateText = useMemo(
//   ()=>(key:keyof DictionaryDataType)=> getLangText(language, key), [language]);
//   return {translateText}
//  }

export const useLanguageTranslation = (language:LanguageKeyType)=>{
// The second argument is optional, so every existing translateText(key) call
// is unaffected. It carries the values a sentence names inside braces - the
// account name, an amount - for the entries that need them.
const translateText = useCallback(
(keyText: keyof DictionaryDataType, values?:TranslationValuesType)=>getLangText(language, keyText, values)
 ,[language]
)
 return {translateText}
}




