#!/bin/bash
# Smoke test for the HTTP API. Needs a running server and a database.
#   npm run dev            (in another terminal, with .env.local set)
#   npm run smoke                          # against http://localhost:3000
#   BASE=http://localhost:3001 npm run smoke
#
# It never deletes anything: every run registers fresh players with random names, so it
# leaves a few "smoke*" users and scores behind. Use a development database.
# Refuses to run against a non-local host unless you set I_KNOW=1.

BASE=${BASE:-http://localhost:3000}
case "$BASE" in
  http://localhost*|http://127.0.0.1*) ;;
  *) [ "$I_KNOW" = 1 ] || { echo "Refusing to run against $BASE (set I_KNOW=1 to override)"; exit 2; } ;;
esac

J=(-H "Content-Type: application/json"); API=$BASE/api; PASS=0; FAIL=0
JAR=$(mktemp); JAR2=$(mktemp); trap 'rm -f "$JAR" "$JAR2"' EXIT
NAME="smoke$RANDOM"; NAME2="smoke$RANDOM"

# check "label" "expected substring" curl-args...   (matches against "<body> [<status>]")
check(){ local label=$1 want=$2; shift 2
  local out; out=$(curl -s -m 30 -w ' [%{http_code}]' "$@")
  if [[ "$out" == *"$want"* ]]; then PASS=$((PASS+1)); echo "ok    $label"; else FAIL=$((FAIL+1)); echo "FAIL  $label"; echo "      wanted: $want"; echo "      got:    $out"; fi; }

echo "API smoke test against $BASE (players $NAME, $NAME2)"
check "health: settings present, database reachable" '"healthy":true' $API/health
check "register: bad name rejected"       '[400]' "${J[@]}" -d '{"name":"a!","password":"secret1"}' $API/auth/register
check "register: short password rejected" '[400]' "${J[@]}" -d "{\"name\":\"$NAME\",\"password\":\"123\"}" $API/auth/register
check "register: 'guest' is reserved"     '[400]' "${J[@]}" -d '{"name":"Guest","password":"secret1"}' $API/auth/register
check "register: ok, keeps chosen colour" '"theme":"red"' "${J[@]}" -c "$JAR" -d "{\"name\":\"$NAME\",\"password\":\"secret1\",\"theme\":\"red\"}" $API/auth/register
check "register: duplicate (any case)"    '[409]' "${J[@]}" -d "{\"name\":\"$(echo $NAME | tr a-z A-Z)\",\"password\":\"secret1\"}" $API/auth/register
check "me: logged in, with colour"        '"theme":"red"' -b "$JAR" $API/auth/me
check "me: no cookie -> null"             '{"user":null}' $API/auth/me
check "login: wrong password"             '[401]' "${J[@]}" -d "{\"name\":\"$NAME\",\"password\":\"nope123\"}" $API/auth/login
check "login: unknown player"             '[401]' "${J[@]}" -d '{"name":"nobodyhere","password":"nope123"}' $API/auth/login
check "login: ok (case-insensitive)"      '"theme":"red"' "${J[@]}" -c "$JAR" -d "{\"name\":\"$(echo $NAME | tr a-z A-Z)\",\"password\":\"secret1\"}" $API/auth/login
check "prefs: needs login"                '[401]' -X PUT "${J[@]}" -d '{"theme":"blue"}' $API/prefs
check "prefs: unknown colour rejected"    '[400]' -X PUT "${J[@]}" -b "$JAR" -d '{"theme":"pink"}' $API/prefs
check "prefs: saves colour"               '"theme":"blue"' -X PUT "${J[@]}" -b "$JAR" -d '{"theme":"blue"}' $API/prefs
check "prefs: colour is on the account"   '"theme":"blue"' -b "$JAR" $API/auth/me
check "scores: needs login"               '[401]' "${J[@]}" -d '{"game":"snake","score":50}' $API/scores
check "scores: unknown game"              '[400]' "${J[@]}" -b "$JAR" -d '{"game":"pong","score":50}' $API/scores
check "scores: not an integer"            '[400]' "${J[@]}" -b "$JAR" -d '{"game":"snake","score":5.5}' $API/scores
check "scores: absurdly large"            '[400]' "${J[@]}" -b "$JAR" -d '{"game":"snake","score":99999999}' $API/scores
check "scores: first is a new best"       '"isNew":true,"best":50' "${J[@]}" -b "$JAR" -d '{"game":"bounce","score":50}' $API/scores
check "scores: lower is not a new best"   '"isNew":false,"best":50' "${J[@]}" -b "$JAR" -d '{"game":"bounce","score":20}' $API/scores
check "scores: higher is a new best"      '"isNew":true,"best":80' "${J[@]}" -b "$JAR" -d '{"game":"bounce","score":80}' $API/scores
curl -s "${J[@]}" -c "$JAR2" -d "{\"name\":\"$NAME2\",\"password\":\"secret2\"}" $API/auth/register >/dev/null
check "scores: second player posts"       '"best":65' "${J[@]}" -b "$JAR2" -d '{"game":"bounce","score":65}' $API/scores
check "leaderboard is public and shared"  "\"name\":\"$NAME2\"" "$API/scores?game=bounce"
check "leaderboard: mine needs login"     '[401]' "$API/scores?game=bounce&mine=1"
check "leaderboard: mine only"            "\"name\":\"$NAME\"" -b "$JAR" "$API/scores?game=bounce&mine=1"
check "league: empty at first"            '{"league":null}' -b "$JAR" $API/league
check "league: bad data rejected"         '[400]' -X PUT "${J[@]}" -b "$JAR" -d '{"round":9,"rows":[]}' $API/league
Z='{"p":0,"w":0,"d":0,"l":0,"gf":0,"ga":0,"pts":0}'
ROWS="[{\"p\":1,\"w\":1,\"d\":0,\"l\":0,\"gf\":3,\"ga\":1,\"pts\":3},{\"p\":1,\"w\":0,\"d\":0,\"l\":1,\"gf\":1,\"ga\":3,\"pts\":0},$Z,$Z,$Z,$Z]"
check "league: saves a season"            '{"ok":true}' -X PUT "${J[@]}" -b "$JAR" -d "{\"round\":1,\"rows\":$ROWS}" $API/league
check "league: reads it back"             '"round":1' -b "$JAR" $API/league
check "league: players are separate"      '{"league":null}' -b "$JAR2" $API/league
check "non-JSON POST rejected"            '[415]' -X POST -d 'x=1' $API/auth/login
check "logout"                            '{"ok":true}' -X POST -c "$JAR" -b "$JAR" $API/auth/logout
check "me after logout"                   '{"user":null}' -b "$JAR" $API/auth/me

echo; echo "$PASS passed, $FAIL failed"; [ "$FAIL" = 0 ]
