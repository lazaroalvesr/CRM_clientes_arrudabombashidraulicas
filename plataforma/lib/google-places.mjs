import { AppError, clean, SEGMENTS, STATES } from './domain.mjs';

const segmentTerms={
  'Concreteira':'concreteira concreto usinado',
  'Bombeamento de concreto':'bombeamento de concreto',
  'Construtora':'construtora',
  'Locadora':'locadora de equipamentos para construção'
};

export async function searchGooglePlaces(filters){
  if(!process.env.GOOGLE_MAPS_API_KEY)throw new AppError('A chave GOOGLE_MAPS_API_KEY não está configurada neste ambiente.',503);
  const state=clean(filters.state,2),city=clean(filters.city,100),segment=clean(filters.segment,50);
  if(!city||!STATES.includes(state)||!SEGMENTS.includes(segment))throw new AppError('Informe estado, cidade e segmento para buscar no Google Maps.');
  const query=`${segmentTerms[segment]} em ${city}, ${state}, Brasil`;
  let response;
  try{response=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.nationalPhoneNumber,places.websiteUri,places.attributions'},body:JSON.stringify({textQuery:query,languageCode:'pt-BR',regionCode:'BR',pageSize:20}),signal:AbortSignal.timeout(20_000)});}
  catch{throw new AppError('Não foi possível consultar o Google Maps agora. Tente novamente.',502);}
  if(!response.ok)throw new AppError('O Google Maps recusou a busca. Verifique a chave e as APIs habilitadas.',502);
  const payload=await response.json();
  return {query,places:(payload.places||[]).map(place=>({placeId:place.id,name:place.displayName?.text||'Empresa sem nome',address:place.formattedAddress||'',mapsUrl:place.googleMapsUri||'',phone:place.nationalPhoneNumber||'',website:place.websiteUri||'',attributions:place.attributions||[]}))};
}
