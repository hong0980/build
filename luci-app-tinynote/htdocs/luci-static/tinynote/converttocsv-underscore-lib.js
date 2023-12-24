var CSV = {
        delimiter: ",",
        detectedDelimiter: ",",
        autodetect: !0,
        quote: '"',
        limit: "",
        isFirstRowHeader: !0,
        headerToUpper: !1,
        headerToLower: !1,
        skipEmptyRows: !0,
        relaxedMode: !0,
        ignoreQuote: !1,
        excelMode: !0,
        sortNeeded: !1,
        maxColumnsFound: 0,
        prevColumnsFound: 0,
        dataRowsFound: 0,
        arHeaderRow: [],
        table: [],
        statsCnt: [],
        displayPoss: "",
        sortPoss: "",
        sortIgnoreCase: !1,
        parse: function (e, t) {
            var n, r = "",
                a = "";
            t = t || function (e, t, n) {
                return n
            }, this.table = [], this.statsCnt = [], this.arHeaderRow = [], this.maxColumnsFound = 0, this.dataRowsFound = 0;
            var o, i, l, u, s = e.split(""),
                c = 0,
                d = s.length,
                f = 0;
            for ("" != this.limit && isNaN(this.limit) && (this.limit = ""), detect = {
                    comma: 0,
                    semi: 0,
                    tab: 0,
                    pipe: 0,
                    colon: 0,
                    space: 0
                }, n = 0; n < d && (!(n > 1) || "\r" != s[n] && "\n" != s[n]); n++) "," == s[n] && detect.comma++, ";" == s[n] && detect.semi++, "\t" == s[n] && detect.tab++, "|" == s[n] && detect.pipe++, ":" == s[n] && detect.colon++, " " == s[n] && detect.space++;
            for (this.detectedDelimiter = this.delimiter, detect.tab >= detect.comma && detect.tab >= detect.pipe && detect.tab >= detect.semi && detect.tab >= detect.colon ? this.detectedDelimiter = "\t" : detect.semi > detect.comma && detect.semi > detect.pipe && detect.semi > detect.tab && detect.semi > detect.colon ? this.detectedDelimiter = ";" : detect.colon > detect.comma && detect.colon > detect.pipe && detect.colon > detect.tab && detect.colon > detect.semi ? this.detectedDelimiter = ":" : detect.pipe > detect.comma && detect.pipe > detect.semi && detect.pipe > detect.tab && detect.pipe > detect.colon ? this.detectedDelimiter = "|" : detect.comma > detect.tab && detect.comma > detect.pipe && detect.comma > detect.semi && detect.comma > detect.colon && (this.detectedDelimiter = ","), 0 == detect.tab && 0 == detect.comma && 0 == detect.pipe && 0 == detect.colon && 0 == detect.semi && detect.space > 0 && (this.detectedDelimiter = " "), this.autodetect && (this.delimiter = this.detectedDelimiter); c < d;)
                if (!this.skipEmptyRows || "\r" != s[c] && "\n" != s[c]) {
                    for (this.table.push(l = []); c < d && "\r" !== s[c] && "\n" !== s[c];) {
                        if (u = o = i = c, this.relaxedMode) {
                            for (;
                                " " === s[c];) ++c;
                            s[c] !== this.quote || this.ignoreQuote ? c = u : o = c
                        }
                        if (this.excelMode && "=" === s[c] && c + 1 < d && s[c + 1] === this.quote && (o = ++c, !0), this.quote !== s[c] || this.ignoreQuote)
                            for (; c < d && "\r" !== s[c] && "\n" !== s[c] && this.delimiter !== s[c];) i = ++c;
                        else {
                            for (o = i = ++c; c < d;) {
                                if (this.quote === s[c]) {
                                    if (this.quote !== s[c + 1]) break;
                                    s[++c] = ""
                                }
                                i = ++c
                            }
                            for (this.quote === s[c] && ++c; c < d && "\r" !== s[c] && "\n" !== s[c] && this.delimiter !== s[c];) ++c
                        }
                        if (l.push(t(this.table.length - 1, l.length, s.slice(o, i).join(""))), " " == this.delimiter)
                            for (; c < d && s[c] == this.delimiter;) ++c;
                        this.delimiter === s[c] && ++c
                    }
                    if (s[c - 1] == this.delimiter && " " != this.delimiter && l.push(t(this.table.length - 1, l.length, "")), l.length > this.maxColumnsFound && (this.maxColumnsFound = l.length), "\r" === s[c] && ++c, "\n" === s[c] && ++c, !this.isFirstRowHeader || f > 0)
                        for (n = 0; n < l.length; n++) {
                            if ((n >= this.statsCnt.length || 0 == f) && (this.statsCnt[n] = {
                                    dateCnt: 0,
                                    intCnt: 0,
                                    realCnt: 0,
                                    emptyCnt: 0,
                                    bitCnt: 0,
                                    equalUsed: !1,
                                    fieldType: "",
                                    fieldDecs: 0,
                                    fieldPrec: 0,
                                    fldMinLen: Number.MAX_VALUE,
                                    fldMaxLen: 0
                                }), r = l[n].replace(/^\s+|\s+$/g, ""), this.excelMode && r.length > 2 && '="' === r.substr(0, 2) && '"' === r.substr(r.length - 1)) {
                                this.statsCnt[n].equalUsed = !0;
                                var p = new RegExp(this.quote + this.quote, "gmi");
                                r = l[n] = r.substr(2, r.length - 3).replace(p, this.quote)
                            }
                            if ("" == r ? this.statsCnt[n].emptyCnt++ : (r.length < this.statsCnt[n].fldMinLen && (this.statsCnt[n].fldMinLen = r.length), r.length > this.statsCnt[n].fldMaxLen && (this.statsCnt[n].fldMaxLen = r.length)), "" != (a = r) && a.isNumeric()) {
                                this.statsCnt[n].realCnt++;
                                var h = a.split(".");
                                h[0].length > this.statsCnt[n].fieldPrec && (this.statsCnt[n].fieldPrec = h[0].length), h.length > 1 && h[1].length > this.statsCnt[n].fieldDecs && (this.statsCnt[n].fieldDecs = h[1].length), r.indexOf(".") < 0 && this.statsCnt[n].intCnt++, "0" !== r && "1" !== r || this.statsCnt[n].bitCnt++
                            }
                            r.isDateMaybe() && this.statsCnt[n].dateCnt++
                        }
                    if (f++, "" != this.limit && f - (this.isFirstRowHeader ? 1 : 0) >= 1 * this.limit) break
                } else c++;
            if (this.dataRowsFound = f - (this.isFirstRowHeader ? 1 : 0), this.isFirstRowHeader && this.table.length > 0)
                for (this.arHeaderRow = this.table.shift(), n = 0; n < this.maxColumnsFound; n++) this.arHeaderRow[n] && "" != this.arHeaderRow[n] || (this.arHeaderRow[n] = "FIELD" + (n + 1)), this.arHeaderRow[n] = this.arHeaderRow[n].trim();
            if (this.arHeaderRow.length > 0)
                for (n = 0; n < this.arHeaderRow.length; n++) this.determineCsvColType(n);
            else if (this.table.length > 0)
                for (n = 0; n < this.maxColumnsFound; n++) this.arHeaderRow[n] && "" != this.arHeaderRow[n] || (this.arHeaderRow[n] = "FIELD" + (n + 1)), this.determineCsvColType(n);
            for (n = 0; n < this.arHeaderRow.length; n++) this.headerToUpper && (this.arHeaderRow[n] = this.arHeaderRow[n].toUpperCase()), this.headerToLower && (this.arHeaderRow[n] = this.arHeaderRow[n].toLowerCase());
            return "" != this.sortPoss && this.table.sort(this.sortCsv), 0
        },
        setSortFlds: function (e) {
            CSV.sortPoss = e.trim()
        },
        sortCsv: function (e, t) {
            if ("" == CSV.sortPoss) return 0;
            var n = [],
                r = [],
                a = [];
            for (n = CSV.sortPoss.split(","), j = 0; j < n.length; j++) switch (r[j] = 1, a[j] = "", "D" == n[j].right(1).toUpperCase() && (r[j] = -1, n[j] = n[j].left(n[j].length - 1)), n[j].left(1).toUpperCase()) {
            case "C":
                a[j] = "C", n[j] = n[j].right(n[j].length - 1);
                break;
            case "N":
                a[j] = "N", n[j] = n[j].right(n[j].length - 1)
            }
            for (j = 0; j < n.length; j++) isNaN(n[j]) ? n[j] = -1 : n[j] = 1 * n[j] - 1;
            for (j = 0; j < n.length; j++) n[j] >= e.length && (n[j] = -1);
            for (j = 0; j < n.length; j++)
                if (!(n[j] < 0))
                    if (isNaN(e[n[j]].replace(/[\$,]/g, "")) || isNaN(t[n[j]].replace(/[\$,]/g, "")) || CSV.dataRowsFound != CSV.statsCnt[n[j]].realCnt + CSV.statsCnt[n[j]].emptyCnt || "C" == a[j])
                        if (CSV.sortIgnoreCase) {
                            if (e[n[j]].toUpperCase() < t[n[j]].toUpperCase()) return -1 * r[j];
                            if (e[n[j]].toUpperCase() > t[n[j]].toUpperCase()) return 1 * r[j]
                        } else {
                            if (e[n[j]] < t[n[j]]) return -1 * r[j];
                            if (e[n[j]] > t[n[j]]) return 1 * r[j]
                        }
            else {
                if (1 * e[n[j]].replace(/[\$,]/g, "") < 1 * t[n[j]].replace(/[\$,]/g, "")) return -1 * r[j];
                if (1 * e[n[j]].replace(/[\$,]/g, "") > 1 * t[n[j]].replace(/[\$,]/g, "")) return 1 * r[j]
            }
            return 0
        },
        determineCsvColType: function (e) {
            return 0 == this.table.length ? "" : (e >= this.statsCnt.length && (this.statsCnt[e] = {
                dateCnt: 0,
                intCnt: 0,
                realCnt: 0,
                emptyCnt: 0,
                bitCnt: 0,
                fieldType: ""
            }), this.table.length == this.statsCnt[e].bitCnt ? (this.statsCnt[e].fieldType = "B", "B") : this.table.length == this.statsCnt[e].dateCnt ? (this.statsCnt[e].fieldType = "D", "D") : this.table.length == this.statsCnt[e].intCnt ? (this.statsCnt[e].fieldType = "I", "I") : this.table.length == this.statsCnt[e].realCnt ? (this.statsCnt[e].fieldType = "N", "N") : this.statsCnt[e].bitCnt > 0 && this.table.length == this.statsCnt[e].bitCnt + this.statsCnt[e].emptyCnt ? (this.statsCnt[e].fieldType = "B", "B") : this.statsCnt[e].dateCnt > 0 && this.table.length == this.statsCnt[e].dateCnt + this.statsCnt[e].emptyCnt ? (this.statsCnt[e].fieldType = "D", "D") : this.statsCnt[e].intCnt > 0 && this.table.length == this.statsCnt[e].intCnt + this.statsCnt[e].emptyCnt ? (this.statsCnt[e].fieldType = "I", "I") : this.statsCnt[e].realCnt > 0 && this.table.length == this.statsCnt[e].realCnt + this.statsCnt[e].emptyCnt ? (this.statsCnt[e].fieldType = "N", "N") : (this.statsCnt[e].fieldType = "VC", "VC"))
        },
        stringify: function (e, t) {
            t = t || function (e, t, n) {
                return n
            };
            var n, r, a, o, i = "",
                l = e.length;
            for (a = 0; a < l; ++a)
                for (a && (i += "\r\n"), n = 0, r = e[a].length; n < r; ++n) n && (i += this.delimiter), o = t(a, n, e[a][n]), /[,\r\n"]/.test(o) && (o = this.quote + o.replace(/"/g, this.quote + this.quote) + this.quote), i += o || 0 === o ? o : "";
            return i
        }
    },
    csvRedQuery;

function SeqObj(e) {
    this.n = e - 1 || 0, this.nInit = this.n, this.next = function () {
        return ++this.n
    }, this.curr = function () {
        return this.n
    }, this.reset = function () {
        this.n = this.nInit
    }
}

function temGetVal(oCsv, s, rownum, seq) {
    var j, k;
    oCsv = oCsv || CSV;
    var rn = rownum + 1,
        nr = oCsv.table.length,
        nh = oCsv.arHeaderRow.length,
        nf = 0,
        br = "\n",
        lb = "{",
        rb = "}",
        tab = "    ";
    for (k = 0; k < oCsv.maxColumnsFound; k++) eval("var f" + (k + 1) + "=''"), eval("var h" + (k + 1) + "=''");
    for (k = 0; k < oCsv.arHeaderRow.length; k++) eval("var h" + (k + 1) + "=oCsv.arHeaderRow[k]");
    if (rownum >= 0)
        for (k = 0; k < oCsv.table[rownum].length; k++) eval("var f" + (k + 1) + "=oCsv.table[rownum][k]");
    nf = rownum >= 0 ? oCsv.table[rownum].length : 0;
    var a = s.split("."),
        b;
    for (j = 0; j < a.length; j++) b = a[j].trim().split("("), "csv" == b[0].trim().toLowerCase() && b.length > 1 && ")" === b[1].trim() && (a[j] = "csv(" + oCsv.quote.enclose('"', "\\") + "," + oCsv.quote.enclose('"', "\\") + ")");
    try {
        return eval(a.join("."))
    } catch (e) {
        return ""
    }
}

function temHandler(e, t, n, r) {
    if (e = e || CSV, "" == t.trim()) return t;
    var a = (t = t.replace(/\r\n|\r|\n/g, "{br}").replace(/{\s/g, "{lb} ").replace(/{$/g, "{lb}").replace(/\s}/g, " {rb}").replace(/^}/g, "{rb}")).replace(/{/g, "{\n").split(/{|}/).join("\n"),
        o = 0,
        i = !1;
    lines = a.split("\n");
    for (var l = []; o < lines.length;) i && "" != lines[o] ? (l.push(temGetVal(e, lines[o], n, r)), i = !1) : "" == lines[o] ? i = !0 : l.push(lines[o]), o++;
    return l.join("")
}

function csvFromTem(e, t, n, r, a, o) {
    var i;
    e = e || CSV;
    var l = "",
        u = new SeqObj;
    for (l += temHandler(e, t, -1, 0), i = 0; i < e.table.length; i++) "false" != temHandler(e, o, i, i).toString().left(5) && (l += temHandler(e, n, i, u.next()), i != e.table.length - 1 && (l += temHandler(e, r, i, u.curr())));
    return l += temHandler(e, a, -1, u.curr())
}

function csvToTable(e, t, n, r) {
    var a, o, i, l = '<div class="row"><div class="col-md-12"><div class="panel panel-success"><div class="panel-heading "><h3 class="panel-title">CSV Preview</h3></div><table class="table table-striped table-bordered table-hover table-condensed">\n',
        u = 0,
        s = "",
        c = [];
    for (i = getFldPosArr(e = e || CSV), o = 0; o < e.maxColumnsFound; o++) c.push(0);
    if (e.isFirstRowHeader || t) {
        for (l += "<thead><tr>", n && (l += "<th>#</th>"), u = 0; u < i.length; u++) l += '<th title="Field #' + ((o = i[u] - 1) + 1) + '">' + (s = o > e.arHeaderRow.length ? "FIELD" + o : e.arHeaderRow[o]).toHtml().replace(/\r\n|\r|\n/g, "<br/>") + "</th>\n";
        l += "</tr></thead>\n"
    }
    for (l += "<tbody>", a = 0; a < e.table.length; a++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (s = temHandler(e, csvRedQuery.query, a, a)).toString().left(5)) {
            for (l += "<tr>", n && (l += "<td>" + (a + 1) + "</td>\n"), u = 0; u < i.length; u++) s = (o = i[u] - 1) >= e.table[a].length ? " " : e.table[a][o], !e.statsCnt[o] || "N" != e.statsCnt[o].fieldType && "I" != e.statsCnt[o].fieldType ? ("" == s && (s = " "), l += "<td>" + s.toHtml().replace(/\r\n|\n|\r/g, "<br/>") + "</td>\n") : (l += '<td align="right">' + s.toFixed(e.statsCnt[o].fieldDecs) + "</td>\n", c[o] += 1 * s);
            l += "</tr>\n"
        } if (l += "</tbody>", r) {
        for (l += "<tfoot><tr>", n && (l += "<th>Sum</th>"), u = 0; u < i.length; u++) o = i[u] - 1, !e.statsCnt[o] || "N" != e.statsCnt[o].fieldType && "I" != e.statsCnt[o].fieldType ? l += "<th>&nbsp;</th>" : l += '<th align="right">' + c[o].toFixed(e.statsCnt[o].fieldDecs) + "</th>\n";
        l += "</tr></tfoot>\n"
    }
    return l += "</table></div></div></div>"
}

function csvToXml(e, t, n) {
    var r, a, o, i = 0,
        l = t || "ROWSET",
        u = n || "ROW",
        s = '<?xml version="1.0"?>\n<' + l + ">\n",
        c = 0,
        d = "",
        f = "";
    if (o = getFldPosArr(e = e || CSV), 0 === e.table.length) return s + "</" + l + ">";
    for (a = getCsvHeader(e), i = 0; i < e.table.length; i++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (d = temHandler(e, csvRedQuery.query, i, i)).toString().left(5)) {
            for (s += "<" + u + ">\n", c = 0; c < o.length; c++) d = (r = o[c] - 1) >= e.table[i].length ? "" : e.table[i][r] + "", s += "<" + (f = r >= a.length ? "FIELD" + r : a[r]).replace(/\s+/g, "_") + ">" + d.toXml() + "</" + f.replace(/\s+/g, "_") + ">\n";
            s += "</" + u + ">\n"
        } return s += "</" + l + ">"
}

function csvToXmlProperties(e, t, n) {
    var r, a, o, i = 0,
        l = t || "ROWSET",
        u = n || "ROW",
        s = '<?xml version="1.0"?>\n<' + l + ">\n",
        c = 0,
        d = "";
    if (o = getFldPosArr(e = e || CSV), 0 === e.table.length) return s + "</" + l + ">";
    for (a = getCsvHeader(e), i = 0; i < e.table.length; i++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (d = temHandler(e, csvRedQuery.query, i, i)).toString().left(5)) {
            for (s += "<" + u, c = 0; c < o.length; c++) d = (r = o[c] - 1) >= e.table[i].length ? "" : e.table[i][r], s += " " + (r >= a.length ? "FIELD" + r : a[r]).replace(/\s+/g, "_") + '="' + (d + "").toXml() + '"';
            s += "></" + u + ">\n"
        } return s += "</" + l + ">"
}

function csvToJSON(e, t) {
    var n, r, a, o = 0,
        i = "[\n",
        l = 0,
        u = "";
    if (a = getFldPosArr(e = e || CSV), 0 === e.table.length) return i + "]";
    for (r = getCsvHeader(e), o = 0; o < e.table.length; o++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (u = temHandler(e, csvRedQuery.query, o, o)).toString().left(5)) {
            for (i += "  {\n", l = 0; l < a.length; l++) u = (n = a[l] - 1) >= e.table[o].length ? "" : e.table[o][n], i += '    "' + (n >= r.length || !r[n] || "" == r[n] ? "FIELD" + (l + 1) : r[n]).toJson() + '":', t || !e.statsCnt[n] || "N" != e.statsCnt[n].fieldType && "I" != e.statsCnt[n].fieldType ? i += '"' + u.toJson() + '"' : "" != u ? ("." == (u = u.toNumber() + "").left(1) && (u = "0" + u), "-." == u.left(2) && (u = "-0" + u.substr(1)), i += u) : i += "null", i += (l < a.length - 1 ? "," : "") + "\n";
            i += "  }", o < e.table.length - 1 && (i += ","), i += "\n"
        } return i += "]"
}

function csvToJSONArray(e, t) {
    var n, r, a, o = 0,
        i = "[\n",
        l = 0,
        u = "";
    if (a = getFldPosArr(e = e || CSV), 0 === e.table.length) return i + "]";
    for (r = getCsvHeader(e), o = 0; o < e.table.length; o++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (u = temHandler(e, csvRedQuery.query, o, o)).toString().left(5)) {
            for (a.length > 1 && (i += "  ["), l = 0; l < a.length; l++) u = (n = a[l] - 1) >= e.table[o].length ? "" : e.table[o][n], n >= r.length ? "FIELD" + n : r[n], t || !e.statsCnt[n] || "N" != e.statsCnt[n].fieldType && "I" != e.statsCnt[n].fieldType ? i += '"' + u.toJson() + '"' : "" != u ? ("." == (u = u.toNumber() + "").left(1) && (u = "0" + u), "-." == u.left(2) && (u = "-0" + u.substr(1)), i += u) : i += "null", i += l < a.length - 1 ? "," : "";
            a.length > 1 && (i += "  ]"), o < e.table.length - 1 && (i += ","), i += "\n"
        } return i += "]"
}

function csvToJSONColumnArray(e, t) {
    var n, r, a, o = 0,
        i = "{\n",
        l = 0,
        u = "";
    if (a = getFldPosArr(e = e || CSV), 0 === e.table.length) return i + "]";
    for (r = getCsvHeader(e), l = 0; l < a.length; l++) {
        n = a[l] - 1, i += '    "' + (l >= r.length ? "FIELD" + n : r[n]) + '":[';
        var s = 0;
        for (o = 0; o < e.table.length; o++) csvRedQuery && "" != csvRedQuery.query && "false" == (u = temHandler(e, csvRedQuery.query, o, o)).toString().left(5) || (i += ++s > 1 ? "," : "", u = l >= e.table[o].length ? "" : e.table[o][n], t || !e.statsCnt[n] || "N" != e.statsCnt[n].fieldType && "I" != e.statsCnt[n].fieldType ? i += '"' + u.toJson() + '"' : "" != u ? ("." == (u = u.toNumber() + "").left(1) && (u = "0" + u), "-." == u.left(2) && (u = "-0" + u.substr(1)), i += u) : i += "null");
        i += "]", l < a.length - 1 && (i += ","), i += "\n"
    }
    return i += "}"
}

function jsonToCsv(objArray, delimiter, bIncludeHeaders, bQuotes, noMultiLines) {
    var array, str = "",
        line = "",
        i, j, index, value, columns = [];
    try {
        array = "object" != typeof objArray ? JSON.parse(objArray) : objArray
    } catch (e) {
        array = eval("array=" + objArray)
    }
    var depth = getJsonLevel(array);
    if (2 == depth && _.isArray(array)) {
        for (bIncludeHeaders && (value = "Field1", line += bQuotes ? '"' + value.replace(/"/g, '""') + '"' + delimiter : value.toCsv(delimiter, '"'), str += line + "\n"), i = 0; i < array.length; i++) {
            var line = "";
            value = array[i], null == value ? value = "" : value += "", noMultiLines && (value = value.replace(/\r\n|\r|\n/g, " ")), line += (bQuotes ? '"' : "") + ("" + value).toCsv(delimiter, '"') + (bQuotes ? '"' : ""), str += line + "\n"
        }
        return str
    }
    if (3 == depth && _.isArray(array) && _.every(_.values(array), _.isArray)) {
        if (bIncludeHeaders) {
            var head = array[0];
            for (index in array[0]) value = "Field" + (1 * index + 1), columns.push(value), line += bQuotes ? '"' + value.replace(/"/g, '""') + '"' + delimiter : value.toCsv(delimiter, '"') + delimiter;
            line = line.slice(0, -1), str += line + "\n"
        } else
            for (index in array[0]) columns.push(index);
        for (i = 0; i < array.length; i++) {
            var line = "";
            for (j = 0; j < columns.length; j++) value = array[i][j], null == value ? value = "" : value += "", noMultiLines && (value = value.replace(/\r\n|\r|\n/g, " ")), line += (bQuotes ? '"' : "") + ("" + value).toCsv(delimiter, '"') + (bQuotes ? '"' : "") + delimiter;
            line = line.slice(0, -1 * delimiter.length), str += line + "\n"
        }
        return str
    }
    for (; _.isObject(array) && !_.isArray(array) && 1 == _.keys(array).length && (_.isObject(_.values(array)[0]) || _.isArray(_.values(array)[0]) && _.isObject(_.values(array)[0][0]));) array = _.values(array)[0];
    for (0 == _.isArray(array) && 1 == _.isObject(array) && (array = JSON.flatten(array), array = JSON.parse("[" + JSON.stringify(array) + "]")), i = 0; i < array.length; i++) value = array[i][columns[j]], 0 == _.isArray(value) && 1 == _.isObject(value) && (array[i][columns[j]] = JSON.flatten(value));
    if (bIncludeHeaders) {
        var head = array[0];
        if (bQuotes)
            for (index in array[0]) value = index + "", columns.push(value), line += '"' + value.replace(/"/g, '""') + '"' + delimiter;
        else
            for (index in array[0]) value = index + "", columns.push(value), line += value.toCsv(delimiter, '"') + delimiter;
        line = line.slice(0, -1), str += line + "\n"
    } else
        for (index in array[0]) columns.push(index);
    for (i = 0; i < array.length; i++) {
        var line = "";
        if (bQuotes)
            for (j = 0; j < columns.length; j++) value = array[i][columns[j]], "[object Object]" == (value + "").substring(0, 15) && (value = JSON.valueArray(array[i][columns[j]]).slice(0, -1)), null == value ? value = "" : value += "", noMultiLines && (value = value.replace(/\r\n|\r|\n/g, " ")), line += '"' + value.replace(/"/g, '""') + '"' + delimiter;
        else
            for (j = 0; j < columns.length; j++) value = array[i][columns[j]], "[object Object]" == (value + "").substring(0, 15) && (value = JSON.valueArray(array[i][columns[j]]).slice(0, -1)), null == value ? value = "" : value += "", noMultiLines && (value = value.replace(/\r\n|\r|\n/g, " ")), line += ("" + value).toCsv(delimiter, '"') + delimiter;
        line = line.slice(0, -1 * delimiter.length), str += line + "\n"
    }
    return str
}

function csvToFixed(e, t, n, r, a, o) {
    var i, l, u = 0,
        s = "",
        c = 0,
        d = "",
        f = "",
        p = "";
    l = getFldPosArr(e);
    var h = !1,
        g = !1;
    if (void 0 !== t && null != t || (t = " "), !n || "" !== t && " " !== t || (t = "|"), 0 === (e = e || CSV).table.length) return s;
    var m = getCsvHeader(e),
        y = getCsvColLength(e),
        v = 0,
        C = "";
    if (n) {
        for (c = 0; c < l.length; c++) i = l[c] - 1, e.isFirstRowHeader && m[i] && m[i].length > y[i] && (y[i] = m[i].length), v += y[i] + 1;
        if (r && (v += ("" + e.table.length).length + 1), s += "+".rpad(v, "-") + "+\n", e.isFirstRowHeader) {
            for (s += t, r && (s += "#".rpad(("" + e.table.length).length) + t), c = 0; c < l.length; c++) c > 0 && (s += t), s += (d = (i = l[c] - 1) >= m.length ? "" : m[i].replace(/\r\n|\r|\n/g, " ")).rpad(y[i]);
            s += t + "\n", s += "+".rpad(v, "-") + "+\n"
        }
    }
    var b = 0;
    for (u = 0; u < e.table.length; u++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (d = temHandler(e, csvRedQuery.query, u, u)).toString().left(5)) {
            for (b++, n && (s += t), r && (s += ("" + b).rpad(("" + e.table.length).length) + t), c = 0; c < l.length; c++) c > 0 && (s += t), d = (i = l[c] - 1) >= e.table[u].length ? "" : e.table[u][i], g = !1, h = !1, document.getElementById("ftrim" + (i + 1)) && document.getElementById("ftrim" + (i + 1)).checked && (d = d.trim()), document.getElementById("chkupper" + (i + 1)) && document.getElementById("chkupper" + (i + 1)).checked && (d = d.toUpperCase()), document.getElementById("chklower" + (i + 1)) && document.getElementById("chklower" + (i + 1)).checked && (d = d.toLowerCase()), document.getElementById("chkrjust" + (i + 1)) && document.getElementById("chkrjust" + (i + 1)).checked && (g = !0), document.getElementById("chkcjust" + (i + 1)) && document.getElementById("chkcjust" + (i + 1)).checked && (h = !0), s += h ? d.replace(/\r\n|\r|\n/g, " ").cjust(y[i]) : g ? d.replace(/\r\n|\r|\n/g, " ").rjust(y[i]) : d.replace(/\r\n|\r|\n/g, " ").rpad(y[i]);
            var E;
            if (!n && a && 1 == b) {
                for (E = 1; E <= s.length; E++) f += ("" + E).right(1);
                if (s.length >= 10) {
                    for (E = 1, c = 10; c <= s.length; c += 10, E++) p += "         " + ("" + E).right(1);
                    f = (p = p.rpad(f.length)) + "\n" + f
                }
            }
            n && (s += t), s += "\n", n && o && (s += "+".rpad(v, "-") + "+\n")
        } return n && !o && (s += "+".rpad(v, "-") + "+\n"), a && !n && (C = f.split("\n")[1].replace(/[12346789]/g, "-").replace(/0/g, "|").replace(/5/g, "+"), s = f + "\n" + C + "\n" + s), s
}

function fixedToCsv(e, t, n, r, a) {
    var o, i, l = t.split("|") || [],
        u = "",
        s = "",
        c = [],
        d = "",
        f = e.split(/\n|\r|\r\n/gim);
    if ("" == f[f.length - 1] && f.pop(), r) {
        for (o = 0; o < l.length; o++) d = (c = l[o].split(",")).length > 2 ? c[2] : "F" + (o + 1), u += a ? '"' + d.replace(/"/g, '""') + '"' + n : d.toCsv(n, '"') + n;
        u = u.slice(0, -1 * n.length) + "\n"
    }
    var p = 0,
        h = 0;
    for (o = 0; o < f.length; o++)
        if (s = "", "" != f[o]) {
            for (i = 0; i < l.length; i++) p = (c = l[i].split(",") || []).length > 0 ? c[0] - 1 : 0, h = c.length > 1 ? c[1] : 0, c.length > 2 ? c[2] : "f" + (i + 1), value = f[o].substr(p, h).trim(), null == value ? value = "" : value += "", s += a ? '"' + ("" + value).replace(/"/g, '""') + '"' + n : ("" + value).toCsv(n, '"') + n;
            u += (s = s.slice(0, -1 * n.length)) + "\n"
        } return u
}

function csvToMulti(e, t, n, r, a, o) {
    var i, l, u = 0,
        s = "",
        c = 0,
        d = "",
        f = "";
    if (o = o || "0", isNaN("0" + o) && (o = "0"), l = getFldPosArr(e), r = r || "", 0 === (e = e || CSV).table.length) return s;
    for (getCsvHeader(e), u = 0; u < e.table.length; u++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (d = temHandler(e, csvRedQuery.query, u, u)).toString().left(5)) {
            for (c = 0; c < l.length; c++) f = "", d = (i = l[c] - 1) >= e.table[u].length ? "" : e.table[u][i].replace(/\r\n|\r|\n/g, " "), n && (f = i >= e.arHeaderRow.length ? "".rpad(o) + "Field-" + (i + 1) + r : "".rpad(o) + e.arHeaderRow[i].replace(/\r\n|\r|\n/g, " ") + r), s += f + d + "\n", a && (s += "\n");
            s += t + "\n"
        } return s
}

function csvToKml(e, t, n, r, a, o) {
    var i, l, u = 0,
        s = "",
        c = '<?xml version="1.0" encoding="UTF-8"?>\n';
    if (c += '<kml xmlns="http://earth.google.com/kml/2.0">\n', c += "<Document>\n", 0 === (e = e || CSV).table.length) return c + "</Document></kml>";
    for (l = getCsvHeader(e), ("" == o.trim() || isNaN(o) || 1 * o < 1 || 1 * o > e.table[0].length) && (o = ""), u = 0; u < e.table.length; u++)
        if (!csvRedQuery || "" == csvRedQuery.query || (v = temHandler(e, csvRedQuery.query, u, u), "false" != v.toString().left(5))) {
            for (c += "<Placemark>\n", s = "", i = 0; i < e.table[u].length && !(i >= l.length); i++)
                if ((isNaN(r) || i != r - 1) && (isNaN(a) || i != a - 1)) {
                    if (isNaN(t) || i != t - 1) {
                        if (isNaN(n) || i != n - 1) continue;
                        l[i] = "description", "" != o && (s = " " + e.table[u][o - 1])
                    } else l[i] = "name";
                    c += "<" + l[i] + ">" + e.table[u][i].toHtml() + s.toHtml() + "</" + l[i] + ">\n"
                }! isNaN(r) && !isNaN(a) && r.length > 0 && a.length > 0 && 1 * r <= e.table[u].length && 1 * a <= e.table[u].length && e.table[u][1 * r - 1] && e.table[u][1 * a - 1] && (c += "<Point><coordinates>", c += e.table[u][1 * a - 1] + "," + e.table[u][1 * r - 1] + ",0", c += "</coordinates></Point>\n"), c += "</Placemark>\n"
        } return c += "</Document>\n</kml>"
}

function csvToCsv(e, t, n, r, a, o, i) {
    if (0 === (e = e || CSV).table.length) return "";
    var l, u, s, c, d = 0,
        f = "",
        p = 0;
    if (s = getFldPosArr(e), n || a) {
        for (u = getCsvHeader(e), p = 0; p < s.length; p++) p > 0 && (f += t), f += ((d = s[p] - 1) >= u.length ? "" : u[d]).toCsv(t, e.quote);
        "" != f && (f += "\n")
    }
    for (d = 0; d < e.table.length; d++)
        if (!csvRedQuery || "" == csvRedQuery.query || "false" != (c = temHandler(e, csvRedQuery.query, d, d)).toString().left(5)) {
            for (p = 0; p < s.length; p++) l = s[p] - 1, (c = e.table[d][l] ? e.table[d][l] : "") && o && (c = c.replace(/\r\n|\r|\n/g, " ")), r && "" != c ? c.indexOf(",") < 0 ? f += "=" + c.toCsv(t, e.quote, e.quote, r) : f += '"="' + c.toCsv(t, e.quote, e.quote, r) + '""' : i || !e.statsCnt[l] || "N" != e.statsCnt[l].fieldType && "I" != e.statsCnt[l].fieldType ? f += c.toCsv(t, e.quote, e.quote, i) : f += c || "", f += p < s.length - 1 ? t : "";
            f += "\n"
        } return f
}

function getCsvColLength(e) {
    var t = 0,
        n = 0,
        r = 0,
        a = new Array;
    if (0 === (e = e || CSV).table.length) return a;
    for (n = 0; n < e.maxColumnsFound; n++) a.push(0);
    for (t = 0; t < e.table.length; t++)
        for (n = 0; n < a.length; n++) n >= e.table[t].length || (e.table[t][n].length > a[n] && (a[n] = e.table[t][n].length), document.getElementById("fpadsize" + (n + 1)) && (r = document.getElementById("fpadsize" + (n + 1)).value, isNaN(r) ? r = 0 : r *= 1, r > a[n] && (a[n] = r)));
    return a
}

function isSqlKeywords() {
    return ["ACTION", "ADD", "AFTER", "ALL", "ALTER", "ANALYZE", "AND", "AS", "ASC", "ATTACH", "AUTOINCREMENT", "BEFORE", "BEGIN", "BETWEEN", "BY", "CASCADE", "CASE", "CAST", "CHECK", "COLLATE", "COLUMN", "COMMIT", "CONFLICT", "CONSTRAINT", "CREATE", "CROSS", "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "DATABASE", "DEFAULT", "DEFERRABLE", "DEFERRED", "DELETE", "DESC", "DETACH", "DISTINCT", "DROP", "EACH", "ELSE", "END", "ESCAPE", "EXCEPT", "EXCLUSIVE", "EXISTS", "EXPLAIN", "FAIL", "FOR", "FOREIGN", "FROM", "FULL", "GLOB", "GROUP", "HAVING", "IF", "IGNORE", "IMMEDIATE", "IN", "INDEX", "INDEXED", "INITIALLY", "INNER", "INSERT", "INSTEAD", "INTERSECT", "INTO", "IS", "ISNULL", "JOIN", "KEY", "LEFT", "LIKE", "LIMIT", "MATCH", "NATURAL", "NO", "NOT", "NOTNULL", "NULL", "OF", "OFFSET", "ON", "OR", "ORDER", "OUTER", "PLAN", "PRAGMA", "PRIMARY", "QUERY", "RAISE", "RECURSIVE", "REFERENCES", "REGEXP", "REINDEX", "RELEASE", "RENAME", "REPLACE", "RESTRICT", "RIGHT", "ROLLBACK", "ROW", "SAVEPOINT", "SELECT", "SET", "SUM", "SYSDATE", "TABLE", "TEMP", "TEMPORARY", "THEN", "TO", "TRANSACTION", "TRIGGER", "UNION", "UNIQUE", "UPDATE", "USING", "VACUUM", "VALUES", "VIEW", "VIRTUAL", "WHEN", "WHERE", "WITH", "WITHOUT"]
}

function csvToSql(e, t, n, r, a, o, i, l, u, s, c, d) {
    var f, p, h, g, m, y = 0,
        v = "",
        C = "",
        b = "",
        E = "",
        S = [],
        I = [],
        N = [],
        R = [],
        k = [],
        T = "",
        j = [],
        A = 0;
    if (0 === (e = e || CSV).table.length) return v;
    for (n = n || "I", r = r || !1, m = getCsvHeader(e), p = f = 0; f < m.length; f++) I[f] = m[f].replace(/\s+/g, "_"), j[f] = !1, N[f] = R[f] = "", document.getElementById("fkey" + (f + 1)) && document.getElementById("fkey" + (f + 1)).checked && (A++, j[f] = !0), document.getElementById("fname" + (f + 1)) && (I[f] = document.getElementById("fname" + (f + 1)).value.replace(/\s+/g, "_")), document.getElementById("freq" + (f + 1)) && (k[f] = document.getElementById("freq" + (f + 1)).checked), document.getElementById("fsize" + (f + 1)) ? (N[f] = document.getElementById("fsize" + (f + 1)).value.trim(), isNaN(N[f]) ? N[f] = 30 : N[f] *= 1, N[f] < 1 && (N[f] = "")) : N[f] = 30, document.getElementById("fdec" + (f + 1)) && (R[f] = document.getElementById("fdec" + (f + 1)).value.trim(), isNaN(R[f]) ? R[f] = "" : (R[f] *= 1, R[f] < 0 && (R[f] = ""))), document.getElementById("finc" + (f + 1)) ? document.getElementById("finc" + (f + 1)).checked ? (S[f] = !0, p++) : S[f] = !1 : (S[f] = !0, p++);
    if (0 == p) return "";
    if (t.indexOf(" ") > 0 && (t = '"' + t + '"'), i && (v += "DROP TABLE " + (l ? "IF EXISTS " : "") + t + ";\n"), a) {
        var B = r;
        for (v += "CREATE TABLE " + (o ? "IF NOT EXISTS " : "") + t + "(", (r = !0) && (v += "\n"), p = f = 0; f < m.length; f++, p++) {
            switch (r && p > 0 && (v += "\n"), v += p > 0 ? "," : " ", v += " " + I[f], C = e.statsCnt[f].fieldType, document.getElementById("ftype" + (f + 1)) && (C = document.getElementById("ftype" + (f + 1)).value), C) {
            case "B":
                v += " BIT ";
                break;
            case "NR":
            case "N":
                v += "N" == C ? " NUMERIC" : " NUMBER", h = e.statsCnt[f].fieldPrec + e.statsCnt[f].fieldDecs, g = e.statsCnt[f].fieldDecs, N[f] && N[f] > h && (h = N[f]), v += "" != h ? "(" + h + "," + g + ")" : " ";
                break;
            case "IT":
                v += " INT ";
                break;
            case "I":
                v += " INTEGER", v += "" != (h = N[f]) ? "(" + h + ")" : " ";
                break;
            case "S":
                v += " SERIAL ";
                break;
            case "D":
                v += " DATE ";
                break;
            case "DT":
                v += " DATETIME ";
                break;
            case "VC":
                v += " VARCHAR(" + N[f] + ")";
                break;
            default:
                v += " CHAR(" + N[f] + ")"
            }
            k[f] && (v += " NOT NULL"), j[f] && 1 == A && (v += " PRIMARY KEY", "N" != C && "NR" != C && "I" != C && "IT" != C || document.getElementById("selAutoIncrement") && (v += " " + document.getElementById("selAutoIncrement").value))
        }
        if (A > 1) {
            for (r && (v += "\n"), v += ", PRIMARY KEY(", x = 0; x < j.length; x++) j[x] && (v += (x > 0 ? "," : "") + I[x]);
            v += ")"
        }
        r && (v += "\n"), v += ");\n", r = B
    }
    switch (n) {
    case "I":
        for (y = 0; y < e.table.length; y++)
            if (!csvRedQuery || "" == csvRedQuery.query || "false" != (b = temHandler(e, csvRedQuery.query, y, y)).toString().left(5)) {
                if (0 != y && c) v += ",(";
                else {
                    for (v += u ? "REPLACE" : "INSERT", "" != s.trim() && (v += " " + s.trim()), v += " INTO " + t + "(", r && (v += "\n"), p = f = 0; f < m.length; f++) S[f] && (p > 0 && (v += ","), v += I[f], r && (v += "\n"), p++);
                    v += ") VALUES" + (c ? "\n" : "") + " ("
                }
                for (r && (v += "\n"), p = f = 0; f < m.length; f++)
                    if (S[f]) {
                        if (C = e.statsCnt[f].fieldType, b = f >= e.table[y].length ? "" : e.table[y][f], document.getElementById("ftype" + (f + 1)) && (C = document.getElementById("ftype" + (f + 1)).value), document.getElementById("ftem" + (f + 1)) && (E = document.getElementById("ftem" + (f + 1)).value), document.getElementById("ftrim" + (f + 1)) && document.getElementById("ftrim" + (f + 1)).checked && (b = b.trim()), document.getElementById("chkupper" + (f + 1)) && document.getElementById("chkupper" + (f + 1)).checked && (b = b.toUpperCase()), document.getElementById("chklower" + (f + 1)) && document.getElementById("chklower" + (f + 1)).checked && (b = b.toLowerCase()), p > 0 && (v += ","), "" != E) v += "N" == C || "NR" == C || "I" == C || "IT" == C || "S" == C || "D" == C || "DT" == C ? "" == b ? E.replace("{f}", "NULL") : "D" == C || "DT" == C ? E.replace("{f}", "'" + b.toSql() + "'") : E.replace("{f}", b.toSql()) : E.replace("{f}", "'" + b.toSql() + "'");
                        else switch (C) {
                        case "B":
                        case "NR":
                        case "S":
                        case "N":
                        case "IT":
                        case "I":
                            "" === b.trim() || "NULL" == b.toUpperCase() && d ? v += "NULL" : v += b.toSql();
                            break;
                        case "DT":
                        case "D":
                            "" === b || "NULL" == b.toUpperCase() && d ? v += "NULL" : v += "'" + b.toSql() + "'";
                            break;
                        default:
                            "NULL" == b.toUpperCase() && d ? v += "NULL" : v += "'" + b.toSql() + "'"
                        }
                        r && (v += "\n"), p++
                    } c && y != e.table.length - 1 ? v += ")\n" : v += ");\n"
            } break;
    case "U":
        for (y = 0; y < e.table.length; y++)
            if (!csvRedQuery || "" == csvRedQuery.query || "false" != (b = temHandler(e, csvRedQuery.query, y, y)).toString().left(5)) {
                for (T = "1=1", v += "UPDATE", "" != s.trim() && (v += " " + s.trim()), v += " " + t + " SET ", r && (v += "\n"), f = 0; f < m.length; f++) j[f] && (T += " AND " + I[f] + "= {f" + f + "}");
                for ("1=1" === T && (T += " AND " + I[0] + "= {f0}"), p = f = 0; f < m.length; f++) {
                    switch (S[f] && (p > 0 && (v += ","), v += I[f] + " = ", p++), C = e.statsCnt[f].fieldType, b = f >= e.table[y].length ? "" : e.table[y][f], document.getElementById("ftype" + (f + 1)) && (C = document.getElementById("ftype" + (f + 1)).value), document.getElementById("ftem" + (f + 1)) && (E = document.getElementById("ftem" + (f + 1)).value), document.getElementById("ftrim" + (f + 1)) && document.getElementById("ftrim" + (f + 1)).checked && (b = b.trim()), document.getElementById("chkupper" + (f + 1)) && document.getElementById("chkupper" + (f + 1)).checked && (b = b.toUpperCase()), document.getElementById("chklower" + (f + 1)) && document.getElementById("chklower" + (f + 1)).checked && (b = b.toLowerCase()), "" != E && (v += "" != b || "N" != C && "NR" != C && "I" != C && "IT" != C && "D" != C ? E.replace("{f}", b.toSql()) : E.replace("{f}", "NULL")), C) {
                    case "B":
                        S[f] && (v += "'" + b.toSql() + "'"), T = T.replace("{f" + f + "}", "'" + b.toSql() + "'");
                        break;
                    case "NR":
                    case "N":
                        S[f] && ("" === b || "NULL" == b.toUpperCase() && d ? v += "NULL" : v += b.toSql()), T = T.replace("{f" + f + "}", b.toSql());
                        break;
                    case "IT":
                    case "I":
                        S[f] && ("" === b || "NULL" == b.toUpperCase() && d ? v += "NULL" : v += b.toSql()), T = T.replace("{f" + f + "}", b.toSql());
                        break;
                    case "D":
                        S[f] && (v += "" === b || "NULL" == b && d ? "NULL" : "'" + b.toSql() + "'"), T = T.replace("{f" + f + "}", "'" + b.toSql() + "'");
                        break;
                    default:
                        S[f] && ("NULL" == b.toUpperCase() && d ? v += "NULL" : v += "'" + b.toSql() + "'"), T = T.replace("{f" + f + "}", "'" + b.toSql() + "'")
                    }
                    S[f] && (r && (v += "\n"), p++)
                }
                v += " WHERE " + T, v += ";\n"
            } break;
    case "D":
        for (y = 0; y < e.table.length; y++)
            if (!csvRedQuery || "" == csvRedQuery.query || "false" != (b = temHandler(e, csvRedQuery.query, y, y)).toString().left(5)) {
                for (T = "1=1", v += "DELETE FROM " + t, r && (v += "\n"), f = 0; f < I.length; f++) j[f] && (T += " AND " + I[f] + "= {f" + f + "}");
                for ("1=1" === T && (T += " AND " + I[0] + "= {f0}"), p = f = 0; f < m.length; f++) {
                    switch (p++, C = e.statsCnt[f].fieldType, b = f >= e.table[y].length ? "" : e.table[y][f], document.getElementById("ftype" + (f + 1)) && (C = document.getElementById("ftype" + (f + 1)).value), document.getElementById("ftem" + (f + 1)) && (E = document.getElementById("ftem" + (f + 1)).value), document.getElementById("ftrim" + (f + 1)) && document.getElementById("ftrim" + (f + 1)).checked && (b = b.trim()), document.getElementById("chkupper" + (f + 1)) && document.getElementById("chkupper" + (f + 1)).checked && (b = b.toUpperCase()), document.getElementById("chklower" + (f + 1)) && document.getElementById("chklower" + (f + 1)).checked && (b = b.toLowerCase()), C) {
                    case "B":
                    case "NR":
                    case "N":
                    case "IT":
                    case "S":
                    case "I":
                        T = T.replace("{f" + f + "}", b.toSql());
                        break;
                    default:
                        T = T.replace("{f" + f + "}", "'" + b.toSql() + "'")
                    }
                    r && (v += "\n"), p++
                }
                v += " WHERE " + T, v += ";\n"
            }
    }
    return v
}

function geoJsonToCsv(geo, delimiter, bIncludeHeaders, bQuotes, noMultiLines) {
    var j, s = "",
        value = "",
        cols = {},
        obj = {};
    if ("string" == typeof geo) try {
        geo = JSON.parse(geo)
    } catch (e) {
        geo = eval("geo=" + geo)
    }
    var colnum = 0;
    if ("Feature" === geo.type && (geo = {
            type: "FeatureCollection",
            features: [geo]
        }), "FeatureCollection" === geo.type) {
        for (j = 0; j < geo.features.length; j++)
            for (p in "Point" === geo.features[j].geometry.type ? ("latitude" in cols || (cols.latitude = ++colnum), "longitude" in cols || (cols.longitude = ++colnum)) : cols.coordinates = ++colnum, geo.features[j].properties) p in cols || (cols[p] = ++colnum);
        for (j = 0; j < geo.features.length; j++) {
            for (p in "latitude" in cols && ("Point" === geo.features[j].geometry.type ? (s += (bQuotes ? '"' : "") + geo.features[j].geometry.coordinates[1] + (bQuotes ? '"' : "") + delimiter, s += (bQuotes ? '"' : "") + geo.features[j].geometry.coordinates[0] + (bQuotes ? '"' : "") + delimiter) : (s += (bQuotes ? '""' : "") + delimiter, s += (bQuotes ? '""' : "") + delimiter)), "coordinates" in cols && ("Point" != geo.features[j].geometry.type ? (value = geo.features[j].geometry.coordinates, "[object Object]" == (value + "").substring(0, 15) && (value = JSON.valueArray(value).slice(0, -1)), s += ("" + value).toCsv(delimiter, '"', '"', bQuotes) + delimiter) : s += (bQuotes ? '""' : "") + delimiter), cols) "latitude" != p && "longitude" !== p && "coordinates" !== p && (p in geo.features[j].properties ? (value = geo.features[j].properties[p], null == value ? value = "" : value += "", noMultiLines && (value = value.replace(/\r\n|\r|\n/g, " ")), s += value.toCsv(delimiter, '"', '"', bQuotes) + delimiter) : s += (bQuotes ? '""' : "") + delimiter);
            s = s.slice(0, -1 * delimiter.length) + "\n"
        }
    }
    var t = "";
    if (bIncludeHeaders) {
        for (p in "latitude" in cols && (t += "latitude".toCsv(delimiter, '"', '"', bQuotes) + delimiter), "longitude" in cols && (t += "longitude".toCsv(delimiter, '"', '"', bQuotes) + delimiter), "coordinates" in cols && (t += "coordinates".toCsv(delimiter, '"', '"', bQuotes) + delimiter), cols) "latitude" != p && "longitude" !== p && "coordinates" !== p && (t += p.toCsv(delimiter, '"', '"', bQuotes) + delimiter);
        t = t.slice(0, -1 * delimiter.length) + "\n"
    }
    return t + s
}

function htmlEscape(e) {
    return String(e).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function getCsvHeader(e) {
    var t, n = new Array;
    (e = e || CSV) || alert("Missing oCsv"), e.arHeaderRow || alert("Missing arHeaderRow");
    var r = e.arHeaderRow.length;
    for (r < e.maxColumnsFound && (r = e.maxColumnsFound), t = 0; t < r; t++) e.arHeaderRow[t] || e.arHeaderRow.push("FIELD" + (t + 1)), n.push(e.arHeaderRow[t]), e.headerToUpper ? (e.arHeaderRow[t] = e.arHeaderRow[t].toUpperCase(), n[n.length - 1] = n[n.length - 1].toUpperCase()) : e.headerToLower && (e.arHeaderRow[t] = e.arHeaderRow[t].toLowerCase(), n[n.length - 1] = n[n.length - 1].toLowerCase());
    return n
}

function sqlOptions(e) {
    var t = getCsvColLength(e = e || CSV),
        n = getCsvHeader(e),
        r = "<table>\n<tr>\n<th>Col #</th><th>Field Name</th><th>Data Type</th><th>Max Size</th><th title='# of decimals'>#<br/>Dec</th>";
    r += '<th>Key</th><th>Include</th><th>Required</th><th>Trim</th><th>Upper</th><th>Lower</th><th title="Modify output by using {f} for field value. Ex: {f}+100">Template ({f}=field)<br/>Ex: {f}+100</th></tr>';
    var a, o = "<tr><td>{#}</td>";
    for (o += '<td><input type=text id="fname{#}" size="15" value="{FIELDNAME{#}}"></td>\n', o += '<td><select id="ftype{#}" title="Choose data type of column" >', o += '<option value="VC" {VC{#}}>VarChar</option>', o += '<option value="C" {C{#}}>Char</option>', o += '<option value="NR" {NR{#}}>Number</option>', o += '<option value="N" {N{#}}>Numeric</option>', o += '<option value="IT" {IT{#}}>Int</option>', o += '<option value="I" {I{#}}>Integer</option>', o += '<option value="D" {D{#}}>Date</option>', o += '<option value="DT" {DT{#}}>Date Time</option>', o += '<option value="B" {B{#}}>Bit(0,1)</option>', o += '<option value="S" {S{#}}>Serial</option>', o += '</select>\n</td><td><input id="fsize{#}"size=4 maxlength=4 value="{FIELDSIZE{#}}"></td>\n', o += '<td><input id="fdec{#}"size=2 maxlength=2 value="{DECSIZE{#}}" readonly></td>', o += '<td><input type=checkbox id="fkey{#}"  value="Y" ></td>\n', o += '<td><input type=checkbox id="finc{#}"  value="Y" checked></td>\n', o += '<td><input type=checkbox id="freq{#}"  value="Y" ></td>\n', o += '<td><input type=checkbox id="ftrim{#}" value="Y" checked></td>\n', o += '<td><input type=checkbox id="chkupper{#}"  value="Y" onclick="if(this.checked)document.getElementById(\'chklower{#}\').checked=false"></td>\n', o += '<td><input type=checkbox id="chklower{#}"  value="Y" onclick="if(this.checked)document.getElementById(\'chkupper{#}\').checked=false"></td>\n', o += '<td><input type="text" id="ftem{#}" value="" size="15" maxlength="200"></td>', o += "</tr>", a = 0; a < n.length; a++) r += o.replace(/{#}/g, "" + (a + 1)).replace("{FIELDNAME" + (a + 1) + "}", n[a].replace(/[@+<>"'?\.,-\/#!$%\^&\*;:{}=\-`~()\[\]\\\|]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_")).replace("{FIELDSIZE" + (a + 1) + "}", 0 == t[a] ? 1 : t[a]), r = (r = "N" === e.statsCnt[a].fieldType ? r.replace("{DECSIZE" + (a + 1) + "}", e.statsCnt[a].fieldDecs) : r.replace("{DECSIZE" + (a + 1) + "}", "")).replace("ftitle" + (a + 1) + "}", "Type:" + e.statsCnt[a].fieldType + ",Counts: Total: " + e.table.length + ",Int: " + e.statsCnt[a].intCnt + " ,Numeric:" + e.statsCnt[a].realCnt + ",Bit:" + e.statsCnt[a].bitCnt + ",Date:" + e.statsCnt[a].dateCnt + ",Empty:" + e.statsCnt[a].emptyCnt), "VC" === e.statsCnt[a].fieldType && (r = r.replace("{VC" + (a + 1) + "}", "selected")), "C" === e.statsCnt[a].fieldType && (r = r.replace("{C" + (a + 1) + "}", "selected")), "N" === e.statsCnt[a].fieldType && (r = r.replace("{N" + (a + 1) + "}", "selected")), "I" === e.statsCnt[a].fieldType && (r = r.replace("{I" + (a + 1) + "}", "selected")), "B" === e.statsCnt[a].fieldType && (r = r.replace("{B" + (a + 1) + "}", "selected")), "D" === e.statsCnt[a].fieldType && (r = r.replace("{D" + (a + 1) + "}", "selected")), "S" === e.statsCnt[a].fieldType && (r = r.replace("{S" + (a + 1) + "}", "selected"));
    return r += "</table>"
}

function setOptions(e) {
    var t, n = getCsvHeader(e = e || CSV);
    for (document.getElementById("fkey1") && (document.getElementById("fkey1").checked = !0), document.getElementById("freq1") && (document.getElementById("freq1").checked = !0), t = 0; t < n.length; t++) document.getElementById("fname" + (t + 1)) && (document.getElementById("fname" + (t + 1)).value = n[t].replace(/[@+<>"'?\.,-\/#!$%\^&\*;:{}=\-`~()\[\]\\\|]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_"), document.getElementById("ftype" + (t + 1)) && (e.statsCnt[t] || (document.getElementById("ftype" + (t + 1)).value = e.statsCnt[t].fieldType, document.getElementById("ftype" + (t + 1)).title = "Type:" + e.statsCnt[t].fieldType + ",Counts: Total: " + e.table.length + ",Int: " + e.statsCnt[t].intCnt + " ,Numeric:" + e.statsCnt[t].realCnt + ",Bit:" + e.statsCnt[t].bitCnt + ",Date:" + e.statsCnt[t].dateCnt + ",Empty:" + e.statsCnt[t].emptyCnt)))
}

function flatOptions(e) {
    getCsvColLength(e = e || CSV);
    var t = getCsvHeader(e),
        n = "<table>\n<tr>\n<th>Col #</th><th>Field Name</th><th>Trim</th><th>Pad Size</th>";
    n += "<th>Upper</th><th>Lower</th><th>Right<br/>Justify</th><th>Center<br/>Justify</th></tr>";
    var r, a = "<tr><td>{#}</td>";
    for (a += "<td>{FIELDNAME{#}}</td>\n", a += '<td><input type=checkbox id="ftrim{#}" value="Y" ></td>\n', a += '<td><input type=text id="fpadsize{#}" size=3 maxlength=3 value="" ></td>\n', a += '<td><input type=checkbox id="chkupper{#}"  value="Y" onclick="if(this.checked)document.getElementById(\'chklower{#}\').checked=false"></td>\n', a += '<td><input type=checkbox id="chklower{#}"  value="Y" onclick="if(this.checked)document.getElementById(\'chkupper{#}\').checked=false"></td>\n', a += '<td><input type=checkbox id="chkrjust{#}"  value="Y" onclick="if(this.checked)document.getElementById(\'chkcjust{#}\').checked=false"></td>\n', a += '<td><input type=checkbox id="chkcjust{#}"  value="Y" onclick="if(this.checked)document.getElementById(\'chkrjust{#}\').checked=false"></td>\n', a += "</tr>", r = 0; r < t.length; r++) n += a.replace(/{#}/g, "" + (r + 1)).replace("{FIELDNAME" + (r + 1) + "}", t[r].replace(/\s+/g, "_"));
    return n += "</table>"
}

function parseAndOptions(e, t) {
    e = e || CSV, document.getElementById("txtRowLimit") && (e.limit = document.getElementById("txtRowLimit").value), document.getElementById("chkHeader") && (e.isFirstRowHeader = document.getElementById("chkHeader").checked), document.getElementById("chkHeaderUpper") && (e.headerToUpper = document.getElementById("chkHeaderUpper").checked), document.getElementById("chkHeaderLower") && (e.headerToLower = document.getElementById("chkHeaderLower").checked), document.getElementById("txt1") && CSV.parse(document.getElementById("txt1").value), document.getElementById("divOptions") && (CSV.prevColumnsFound != CSV.maxColumnsFound || t) && (document.getElementById("divOptions").innerHTML = sqlOptions(CSV), setOptions(e), CSV.prevColumnsFound = CSV.maxColumnsFound), document.getElementById("divFlatOptions") && (CSV.prevColumnsFound != CSV.maxColumnsFound || t) && (document.getElementById("divFlatOptions").innerHTML = flatOptions(CSV), CSV.prevColumnsFound = CSV.maxColumnsFound), document.getElementById("divInputCounts") && (document.getElementById("divInputCounts").innerHTML = "Input Records- Header: " + (0 == CSV.arHeaderRow.length && CSV.isFirstRowHeader ? "missing" : CSV.isFirstRowHeader) + " &nbsp; &nbsp;  Separator: " + ("\t" == CSV.delimiter ? "Tab" : " " == CSV.delimiter ? "Space" : CSV.delimiter) + " &nbsp; &nbsp;  Fields: " + CSV.maxColumnsFound + " &nbsp; &nbsp;  Data Records: " + (CSV.dataRowsFound <= 0 ? "0" : CSV.dataRowsFound))
}

function clearAll() {
    var e = !1;
    document.getElementById("chkAppend") && (e = document.getElementById("chkAppend").checked), document.getElementById("sepAuto") && (document.getElementById("sepAuto").checked = !0), CSV && (CSV.delimiter = ",", CSV.autodetect = !0), document.getElementById("txt1") && (document.getElementById("txt1").value = ""), e || document.getElementById("txta") && (document.getElementById("txta").value = ""), document.getElementById("txtCols") && (document.getElementById("txtCols").value = ""), document.getElementById("chkHeader") && (document.getElementById("chkHeader").checked = !0), document.getElementById("chkHeaderUpper") && (document.getElementById("chkHeaderUpper").checked = !1), document.getElementById("chkHeaderLower") && (document.getElementById("chkHeaderLower").checked = !1), e || document.getElementById("diva") && (document.getElementById("diva").innerHTML = ""), document.getElementById("divOptions") && (document.getElementById("divOptions").innerHTML = ""), document.getElementById("divFlatOptions") && (document.getElementById("divFlatOptions").innerHTML = ""), parseAndOptions(), setupSortDD()
}

function getUserOptions(e) {}

function radiovalue(e) {
    if (!e) return "";
    var t = e.length;
    if (null == t) return e.checked ? e.value : "";
    for (var n = 0; n < t; n++)
        if (e[n].checked) return e[n].value;
    return ""
}

function setRadioValue(e, t) {
    if (e) {
        var n = e.length;
        if (null != n) {
            "\t" === (t = (t || "") + "") && (t = "\\t");
            for (var r = 0; r < n; r++) e[r].checked = !1, e[r].value == t && (e[r].checked = !0)
        } else e.checked = e.value == t.toString()
    }
}

function sortStr() {
    var e, t, n;
    for (n = "", t = 1; t <= 4; t++) document.getElementById("selSortFld" + t) && "" != (e = document.getElementById("selSortFld" + t).value) && (t > 1 && (n += ","), n += document.getElementById("selSortType" + t).value + e + document.getElementById("selSortAsc" + t).value);
    return CSV.setSortFlds(n), CSV.mySortNeeded = !0, n
}

function setupSortDD() {
    var e, t, n, r;
    for (t = 1; t <= 4; t++)
        if (e = document.getElementById("selSortFld" + t)) {
            if (e.options.length - 1 == CSV.maxColumnsFound) break;
            for (e.options.length = 1, e.selectedIndex = 0, n = 1; n <= CSV.maxColumnsFound; n++)(r = document.createElement("option")).text = r.value = "" + n, e.options.add(r)
        } sortStr(), typeof csvCreateQueryUI == typeof Function && csvCreateQueryUI(), document.getElementById("btnColsReset") && document.getElementById("btnColsReset").click(), csvRedQuery && (csvRedQuery.query = "")
}

function getFldPosArr(e) {
    var t, n = [];
    if ("" != (e = e || CSV).displayPoss)
        for (t = (n = e.displayPoss.split(",")).length - 1; t >= 0; t--)(isNaN(n[t]) || n[t] < 1 || n[t] > e.maxColumnsFound) && n.splice(t, 1);
    if (0 == n.length)
        for (t = 0; t < e.maxColumnsFound; t++) n[n.length] = t + 1;
    if (0 == n.length)
        for (t = 0; t < e.arHeaderRow.length; t++) n[n.length] = t + 1;
    return n
}

function flattenSqlJson(e) {
    var t, n = [];
    for (t = 0; t < e.length; t++) {
        var r = {};
        for (k = 0; k < e[t].length; k++) r[e[t][k].column] = e[t][k].value;
        n[t] = r
    }
    return n
}

function getExampleCsv() {
    return 'id,name,amount,Remark\n1,"Johnson, Smith, and Jones Co.",345.33,Pays on time\n2,"Sam ""Mad Dog"" Smith",993.44,\n3,"Barney & Company",0,"Great to work with\nand always pays with cash."\n4,Johnson\'s Automotive,2344,\n'
}

function getExampleXml(e) {
    e = (e || 1) - 1;
    return '<?xml version="1.0"?>\n<ROWSET>\n<ROW>\n<id>1</id>\n<name>Johnson, Smith, and Jones Co.</name>\n<amount>345.33</amount>\n<Remark>Pays on time</Remark>\n</ROW>\n<ROW>\n<id>2</id>\n<name>Sam &quot;Mad Dog&quot; Smith</name>\n<amount>993.44</amount>\n<Remark></Remark>\n</ROW>\n<ROW>\n<id>3</id>\n<name>Barney &amp; Company</name>\n<amount>0</amount>\n<Remark>Great to work with\nand always pays with cash.</Remark>\n</ROW>\n<ROW>\n<id>4</id>\n<name>Johnson&apos;s Automotive</name>\n<amount>2344</amount>\n<Remark></Remark>\n</ROW>\n</ROWSET>'
}

function getExampleJson(e) {
    var output = ['[\n  {\n    "id":1,    "name":"Johnson, Smith, and Jones Co.",\n    "amount":345.33,    "Remark":"Pays on time"\n  },\n  {\n    "id":2,    "name":"Sam \\"Mad Dog\\" Smith",\n    "amount":993.44,    "Remark":""\n  },\n  {\n    "id":3,    "name":"Barney & Company",\n    "amount":0,    "Remark":"Great to work with\\nand always pays with cash."\n  },\n  {\n    "id":4,    "name":"Johnson\'s Automotive",\n    "amount":2344,    "Remark":""\n  }\n]\n', '{ "data" : [\n  {    "id":1,    "name":"Johnson, Smith, and Jones Co."  },\n  {    "id":2,    "name":"Sam \\"Mad Dog\\" Smith"  },\n  {    "id":3,    "name":"Barney & Company"  },\n  {    "id":4,    "name":"Johnson\'s Automotive"  }\n] }\n', '{ "race" : \n { "entries" : [\n  {    "id":11,    "name":"Johnson, Smith, and Jones Co."  },\n  {    "id":22,    "name":"Sam \\"Mad Dog\\" Smith"  },\n  {    "id":33,    "name":"Barney & Company"  },\n  {    "id":44,    "name":"Johnson\'s Automotive"  }\n] }\n}\n', '{\n    "id":1,    "name":"Johnson, Smith, and Jones Co.",    "amount":345.33,    "Remark":"Pays on time"\n}\n', '[\n    [      1,      "Johnson, Smith, and Jones Co.",      345.33    ],\n    [      99,      "Acme Food Inc.",      2993.55    ]\n]'][e = (e || 1) - 1];
    $.getScript("https://cdn.bootcdn.net/ajax/libs/ace/1.24.2/mode-hjson.js", function () {
        editor1.getSession().setMode("ace/mode/json");
        editor1.setValue(output);
    });
}

function getExampleKml() {
    return 'National Park,$ Obligated,State,Latitude,Longitude\nAbraham Lincoln Birthplace NHS,"$34,584",KY,37.6116333423,-85.6442940021\nAcadia,"$102,631",ME,44.3593807753,-68.2397319808\nAndersonville,"$65,133",GA,32.197905290823,-84.1302615685733\nAndrew Johnson ,"$17,949",TN,36.1562449930463,-82.8370902853041\nAntietam,"$54,743",MD,39.462381614,-77.7359854016\nAppomattox Court House,"$12,651",VA,37.3826448073,-78.8027430409\nAssateague Island,"$51,921",MD,38.0556022623662,-75.2453836072023\nBig Bend,"$535,983",TX,29.0103562389,-103.311115521\nBig South Fork National River and Recreation Area,"$3,009","TN, KY",36.3837375235,-84.6743069824\n'
}

function getExampleFlat() {
    return '1     Johnson, Smith, and Jones Co.  345.33     Pays on time                  \n2     Sam "Mad Dog" Smith            993.44              \n3     Barney & Company               0          Great to work with and always pays with cash.      \n4     Johnson\'s Automotive           2344        \n'
}

function getExampleYaml() {
    var output = '-\n  id: 1\n  name: John Doe\n  age: 30\n  email: johndoe@example.com\n  hobbies:\n    -\n      name: Reading\n      duration: 5\n    -\n      name: Cooking\n      duration: 3\n-\n  id: 2\n  name: Jane Smith\n  age: 25\n  email: janesmith@example.com\n  hobbies:\n    -\n      name: Painting\n      duration: 7\n    -\n      name: Hiking\n      duration: 4\n-\n  id: 3\n  name: Bob Johnson\n  age: 40\n  email: bobjohnson@example.com\n  hobbies:\n    -\n      name: Photography\n      duration: 6\n    -\n      name: Dancing\n      duration: 2\n';
    $.getScript("https://cdn.bootcdn.net/ajax/libs/ace/1.24.2/mode-yaml.js", function () {
        editor1.getSession().setMode("ace/mode/yaml");
        editor1.setValue(output);
    });
}

function getExampleJavaScript() {
    var output = 'var name = "John";\nconsole.log("Hello, " + name + "!");\n\nvar numbers = [1, 2, 3, 4, 5];\nfor (var i = 0; i < numbers.length; i++) {\n    console.log(numbers[i]);\n}\n\nvar person = {\n    name: "John",\n    age: 30,\n    city: "New York"\n};\nconsole.log(person.name);\n';
    $.getScript("https://cdn.bootcdn.net/ajax/libs/ace/1.24.2/mode-javascript.js", function () {
        editor1.getSession().setMode("ace/mode/javascript");
        editor1.setValue(output);
    });
}

function getExampleCSS() {
    var output = 'body {background-color: #e9ecef;font-family: Arial, sans-serif;}h1 {color: #333;font-size: 24px;}.container {width: 800px;margin: 0 auto;padding: 20px;}@media(min-width: 768px) {.container-md,.container-sm, .container {max-width: 720px;}}';
    $.getScript("https://cdn.bootcdn.net/ajax/libs/ace/1.24.2/mode-css.js", function () {
        editor1.getSession().setMode("ace/mode/css");
        editor1.setValue(output);
    });
}

function getExampleHTML() {
    var output = '<!DOCTYPE html>\n<html><head>\n    <title>Sample Page</title>\n    <link rel="stylesheet" type="text/css" href="styles.css">\n</head>\n<body>\n    <header>\n        <h1>Welcome to My Website</h1>\n    </header>\n    <div class="container">\n        <p>This is a sample paragraph.</p>\n   <a href="#">Click here</a>\n    </div>\n    <script src="scripts.js"></script></body>\n</html>\n';
    $.getScript("https://cdn.bootcdn.net/ajax/libs/ace/1.24.2/mode-html.js", function () {
        editor1.getSession().setMode("ace/mode/html");
        editor1.setValue(output);
    });
}

function getExampleGeoJson(e) {
    return '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[-85.6442940021,37.6116333423]},"properties":{"National Park":"Abraham Lincoln Birthplace NHS","$ Obligated":"$34,584","State":"KY"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-68.2397319808,44.3593807753]},"properties":{"National Park":"Acadia","$ Obligated":"$102,631","State":"ME"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-84.1302615685733,32.197905290823]},"properties":{"National Park":"Andersonville","$ Obligated":"$65,133","State":"GA"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-82.8370902853041,36.1562449930463]},"properties":{"National Park":"Andrew Johnson ","$ Obligated":"$17,949","State":"TN"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-77.7359854016,39.462381614]},"properties":{"National Park":"Antietam","$ Obligated":"$54,743","State":"MD"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-78.8027430409,37.3826448073]},"properties":{"National Park":"Appomattox Court House","$ Obligated":"$12,651","State":"VA"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-75.2453836072023,38.0556022623662]},"properties":{"National Park":"Assateague Island","$ Obligated":"$51,921","State":"MD"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-103.311115521,29.0103562389]},"properties":{"National Park":"Big Bend","$ Obligated":"$535,983","State":"TX"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[-84.6743069824,36.3837375235]},"properties":{"National Park":"Big South Fork National River and Recreation Area","$ Obligated":"$3,009","State":"TN, KY"}}]}'
}

function loadScript(e) {
    var t = document.createElement("script");
    t.type = "text/javascript", t.id = "dynScriptTemp", t.src = e, document.getElementsByTagName("head")[0].appendChild(t)
}

function loadScriptAndRun(e) {
    e.startsWith("?") || (e = "?" + e), loadScript("http://www.ddginc-usa.com/cgi-bin/url-to-json.php" + e)
}

function loadDataAndRun(e) {
    document.getElementById("txt1").value = e.html.join("\n"), document.getElementById("btnRun").click()
}

function loadURL(e) {
    if ("" == e.trim()) return alert("Missing URL"), !1;
    loadScriptAndRun("?callback=loadDataAndRun&url=" + encodeURIComponent(e))
}

function prettyJSON(e, t) {
    t = t || 3;
    if ("undefined" == typeof JSON) return e;
    try {
        if ("string" == typeof e) return JSON.stringify(JSON.parse(e), null, t);
        if ("object" == typeof e) return JSON.stringify(e, null, t)
    } catch (e) {}
    return e
}

function getJsonLevel(e) {
    "string" == typeof e && (e = JSON.parse(e));
    var t, n, r = JSON.stringify(e, null, "\t").split(/\r\n|\n|\r/gm),
        a = 0;
    for (t = 0; t < r.length; t++) "\t" == r[t].charAt(0) && (n = r[t].match(/\t+/gm))[0].length > a && (a = n[0].length);
    return a + 1
}

function saveOutput(e, t, n) {
    var r = new Blob([e], {
        type: "text/plain;charset=utf-8"
    });
    saveAs(r, t)
}

function saveFile(e, t) {
    var n = document.getElementById("fn").value.trim();
    "" == n && (n = document.getElementById("fn").value = "convertcsv"), saveOutput(e.replace(/\r\n|\r|\n/gm, "\r\n"), n + "." + t, null)
}

function loadCsv() {
    storageSup.has_html5_storage() && (document.getElementById("txt1") && "Y" != sessionStorage.getItem("clearPressed") && (document.getElementById("chkHeader") && (document.getElementById("chkHeader").checked = "Y" == localStorage.getItem("csvChkHeader"), setRadioValue(document.forms.frm1.sep, localStorage.getItem("csvDelimiter"))), assignText(storageSup.getCsv())), sessionStorage.setItem("clearPressed", ""))
}

function saveCsv() {
    storageSup.has_html5_storage() && document.getElementById("txt1") && document.getElementById("txt1").value != getExampleCsv() && document.getElementById("txt1").value.length > 0 && storageSup.putCsv(document.getElementById("txt1").value, document.getElementById("chkHeader").checked ? "Y" : "N", radiovalue(document.forms.frm1.sep))
}

function clearPage() {
    storageSup.has_html5_storage() && sessionStorage.setItem("clearPressed", "Y"), window.location.reload(!0)
}
// "object" != typeof JSON && (JSON = {}),
//     function () {
//         "use strict";

//         function f(e) {
//             return e < 10 ? "0" + e : e
//         }
//         "function" != typeof Date.prototype.toJSON && (Date.prototype.toJSON = function () {
//             return isFinite(this.valueOf()) ? this.getUTCFullYear() + "-" + f(this.getUTCMonth() + 1) + "-" + f(this.getUTCDate()) + "T" + f(this.getUTCHours()) + ":" + f(this.getUTCMinutes()) + ":" + f(this.getUTCSeconds()) + "Z" : null
//         }, String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function () {
//             return this.valueOf()
//         });
//         var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
//             escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
//             gap, indent, meta = {
//                 "\b": "\\b",
//                 "\t": "\\t",
//                 "\n": "\\n",
//                 "\f": "\\f",
//                 "\r": "\\r",
//                 '"': '\\"',
//                 "\\": "\\\\"
//             },
//             rep;

//         function quote(e) {
//             return escapable.lastIndex = 0, escapable.test(e) ? '"' + e.replace(escapable, (function (e) {
//                 var t = meta[e];
//                 return "string" == typeof t ? t : "\\u" + ("0000" + e.charCodeAt(0).toString(16)).slice(-4)
//             })) + '"' : '"' + e + '"'
//         }

//         function str(e, t) {
//             var n, r, a, o, i, l = gap,
//                 u = t[e];
//             switch (u && "object" == typeof u && "function" == typeof u.toJSON && (u = u.toJSON(e)), "function" == typeof rep && (u = rep.call(t, e, u)), typeof u) {
//             case "string":
//                 return quote(u);
//             case "number":
//                 return isFinite(u) ? String(u) : "null";
//             case "boolean":
//             case "null":
//                 return String(u);
//             case "object":
//                 if (!u) return "null";
//                 if (gap += indent, i = [], "[object Array]" === Object.prototype.toString.apply(u)) {
//                     for (o = u.length, n = 0; n < o; n += 1) i[n] = str(n, u) || "null";
//                     return a = 0 === i.length ? "[]" : gap ? "[\n" + gap + i.join(",\n" + gap) + "\n" + l + "]" : "[" + i.join(",") + "]", gap = l, a
//                 }
//                 if (rep && "object" == typeof rep)
//                     for (o = rep.length, n = 0; n < o; n += 1) "string" == typeof rep[n] && (a = str(r = rep[n], u)) && i.push(quote(r) + (gap ? ": " : ":") + a);
//                 else
//                     for (r in u) Object.prototype.hasOwnProperty.call(u, r) && (a = str(r, u)) && i.push(quote(r) + (gap ? ": " : ":") + a);
//                 return a = 0 === i.length ? "{}" : gap ? "{\n" + gap + i.join(",\n" + gap) + "\n" + l + "}" : "{" + i.join(",") + "}", gap = l, a
//             }
//         }
//         "function" != typeof JSON.stringify && (JSON.stringify = function (e, t, n) {
//             var r;
//             if (gap = "", indent = "", "number" == typeof n)
//                 for (r = 0; r < n; r += 1) indent += " ";
//             else "string" == typeof n && (indent = n);
//             if (rep = t, t && "function" != typeof t && ("object" != typeof t || "number" != typeof t.length)) throw new Error("JSON.stringify");
//             return str("", {
//                 "": e
//             })
//         }), "function" != typeof JSON.parse && (JSON.parse = function (text, reviver) {
//             var j;

//             function walk(e, t) {
//                 var n, r, a = e[t];
//                 if (a && "object" == typeof a)
//                     for (n in a) Object.prototype.hasOwnProperty.call(a, n) && (void 0 !== (r = walk(a, n)) ? a[n] = r : delete a[n]);
//                 return reviver.call(e, t, a)
//             }
//             if (text = String(text), cx.lastIndex = 0, cx.test(text) && (text = text.replace(cx, (function (e) {
//                     return "\\u" + ("0000" + e.charCodeAt(0).toString(16)).slice(-4)
//                 }))), /^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]").replace(/(?:^|:|,)(?:\s*\[)+/g, ""))) return j = eval("(" + text + ")"), "function" == typeof reviver ? walk({
//                 "": j
//             }, "") : j;
//             throw new SyntaxError("JSON.parse")
//         })
//     }(), JSON.unflatten = function (e) {
//         "use strict";
//         if (Object(e) !== e || Array.isArray(e)) return e;
//         var t, n, r, a, o, i = {};
//         for (var l in e) {
//             t = i, n = "", a = 0;
//             do {
//                 r = l.indexOf(".", a), o = l.substring(a, -1 !== r ? r : void 0), t = t[n] || (t[n] = isNaN(parseInt(o)) ? {} : []), n = o, a = r + 1
//             } while (r >= 0);
//             t[n] = e[l]
//         }
//         return i[""]
//     }, JSON.flatten = function (e) {
//         var t = {};
//         return function e(n, r) {
//             if (Object(n) !== n) t[r] = n;
//             else if (Array.isArray(n)) {
//                 for (var a = 0, o = n.length; a < o; a++) e(n[a], r ? r + "." + a : "" + a);
//                 0 == o && (t[r] = [])
//             } else {
//                 var i = !0;
//                 for (var l in n) i = !1, e(n[l], r ? r + "." + l : l);
//                 i && (t[r] = {})
//             }
//         }(e, ""), t
//     }, JSON.valueArray = function (e) {
//         var t = "";
//         return function e(n, r) {
//             if (Object(n) !== n) t += n + "|";
//             else if (Array.isArray(n)) {
//                 for (var a = 0, o = n.length; a < o; a++) e(n[a], r ? r + "." + a : "" + a);
//                 0 == o && (t += "|")
//             } else {
//                 var i = !0;
//                 for (var l in n) i = !1, e(n[l], r ? r + "." + l : l);
//                 i && (t += "|")
//             }
//         }(e, ""), t
//     }, String.prototype.lpad = function (e, t) {
//         if (void 0 === t) t = " ";
//         for (var n = this; n.length < e;) n = t + n;
//         return n
//     }, String.prototype.zeroPad = function (e) {
//         var t = this,
//             n = !1;
//         return isNaN(t) ? t : t.length > e ? t.toString() : (0 > t && (n = !0), n ? "0" == (t = t.substring(1).lpad(e, "0")).charAt(0) && (t = "-" + t.substring(1)) : t = t.lpad(e, "0"), t)
//     }, String.prototype.rpad = function (e, t) {
//         if (void 0 === t) t = " ";
//         for (var n = this; n.length < e;) n += t;
//         return n
//     }, "function" != typeof String.prototype.trim && (String.prototype.trim = function () {
//         return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "")
//     }), String.prototype.ltrim = function () {
//         return this.replace(/^\s+/, "")
//     }, String.prototype.rtrim = function () {
//         return this.replace(/\s+$/g, "")
//     }, "function" != typeof String.prototype.repeat && (String.prototype.repeat = function (e) {
//         return e = e || 1, Array(e + 1).join(this)
//     }), String.prototype.ljust = function (e, t) {
//         return t = (t = t || " ").substr(0, 1), this.length < e ? this + t.repeat(e - this.length) : this
//     }, String.prototype.rjust = function (e, t) {
//         return t = (t = t || " ").substr(0, 1), this.length < e ? t.repeat(e - this.length) + this : this
//     }, String.prototype.cjust = function (e, t) {
//         if (t = (t = t || " ").substr(0, 1), this.length < e - 1) {
//             var n = e - this.length,
//                 r = n % 2 == 0 ? "" : t,
//                 a = t.repeat(Math.floor(n / 2));
//             return a + this + a + r
//         }
//         return this.rpad(e)
//     }, "function" != typeof String.prototype.left && (String.prototype.left = function (e) {
//         return this.substring(0, e)
//     }), "function" != typeof String.prototype.right && (String.prototype.right = function (e) {
//         return this.substring(this.length - e)
//     }), String.prototype.removePunctuation = function () {
//         return this.replace(/[@+<>"'?\.,-\/#!$%\^&\*;:{}=\-_`~()\[\]\\\|]/g, "")
//     }, "function" != typeof String.prototype.enclose && (String.prototype.enclose = function (e, t) {
//         if (void 0 === e && (e = ""), void 0 === t && (t = ""), "" != t) {
//             var n = new RegExp(e.regExpEscape(e), "gmi");
//             return e + this.replace(n, t + e) + e
//         }
//         return e + this + e
//     }), String.prototype.toHtml = function () {
//         return this.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
//     }, String.prototype.toXml = function () {
//         return this.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
//     }, String.prototype.toCsv = function (e, t, n, r) {
//         void 0 === e && (e = ","), void 0 === t && (t = '"'), void 0 === n && (n = t), void 0 === r && (r = !1);
//         var a = this.indexOf(t) >= 0 || this.indexOf(e) >= 0 || this.indexOf("\r") >= 0 || this.indexOf("\n") >= 0;
//         return r && (a = !0), a ? this.enclose(t, n) : this
//     }, "function" != typeof String.prototype.isNumeric && (String.prototype.isNumeric = function () {
//         return !isNaN(parseFloat(this)) && isFinite(this)
//     }), String.prototype.toNumber = function () {
//         var e = this.replace(/[^\d.\-\+eE]/g, "");
//         return e.length > 0 && !isNaN(e) && (e *= 1), e
//     }, String.prototype.toInteger = function () {
//         return parseInt(this.toNumber().toString(), 10)
//     }, String.prototype.toFixed = function (e) {
//         var t = this.toNumber().toString();
//         return t.length > 0 && !isNaN(t) && (t = (1 * t).toFixed(e)), String(t)
//     }, String.prototype.toDollar = function (e, t) {
//         var n = this.toNumber().toString();
//         if (void 0 === e && (e = 2), void 0 === t && (t = "$"), n.length > 0 && !isNaN(n)) {
//             var r, a, o;
//             a = (r = (1 * n).toFixed(e).split("."))[0], o = r.length > 1 ? "." + r[1] : "";
//             for (var i = /(\d+)(\d{3})/; i.test(a);) a = a.replace(i, "$1,$2");
//             n = t + a + o
//         }
//         return String(n)
//     }, String.prototype.toJson = function () {
//         return this.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")
//     }, String.prototype.toSql = function () {
//         return this.replace(/'/g, "''")
//     }, String.prototype.toYaml = function () {
//         return /[\r\n\f\v\t]/g.test(this) ? '"' + this.replace(/\t/g, "\\t").replace(/\"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\f/g, "\\f").replace(/\v/g, "\\v").replace(/"/g, '\\"') + '"' : this.indexOf("'") >= 0 ? "'" + this.replace(/'/g, "''") + "'" : this
//     }, String.prototype.regExpEscape = function (e) {
//         return e.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
//     }, RegExp.prototype.escape = function (e) {
//         return e.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
//     },
//     function (e, t) {
//         var n, r;
//         "object" == typeof exports && "undefined" != typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define("underscore", t) : (e = e || self, n = e._, (r = e._ = t()).noConflict = function () {
//             return e._ = n, r
//         })
//     }(this, (function () {
//         var e = "1.11.0",
//             t = "object" == typeof self && self.self === self && self || "object" == typeof global && global.global === global && global || Function("return this")() || {},
//             n = Array.prototype,
//             r = Object.prototype,
//             a = "undefined" != typeof Symbol ? Symbol.prototype : null,
//             o = n.push,
//             i = n.slice,
//             l = r.toString,
//             u = r.hasOwnProperty,
//             s = "undefined" != typeof ArrayBuffer,
//             c = Array.isArray,
//             d = Object.keys,
//             f = Object.create,
//             p = s && ArrayBuffer.isView,
//             h = isNaN,
//             g = isFinite,
//             m = !{
//                 toString: null
//             }.propertyIsEnumerable("toString"),
//             y = ["valueOf", "isPrototypeOf", "toString", "propertyIsEnumerable", "hasOwnProperty", "toLocaleString"],
//             v = Math.pow(2, 53) - 1;

//         function C(e, t) {
//             return t = null == t ? e.length - 1 : +t,
//                 function () {
//                     for (var n = Math.max(arguments.length - t, 0), r = Array(n), a = 0; a < n; a++) r[a] = arguments[a + t];
//                     switch (t) {
//                     case 0:
//                         return e.call(this, r);
//                     case 1:
//                         return e.call(this, arguments[0], r);
//                     case 2:
//                         return e.call(this, arguments[0], arguments[1], r)
//                     }
//                     var o = Array(t + 1);
//                     for (a = 0; a < t; a++) o[a] = arguments[a];
//                     return o[t] = r, e.apply(this, o)
//                 }
//         }

//         function b(e) {
//             var t = typeof e;
//             return "function" === t || "object" === t && !!e
//         }

//         function E(e) {
//             return !0 === e || !1 === e || "[object Boolean]" === l.call(e)
//         }

//         function S(e) {
//             return function (t) {
//                 return l.call(t) === "[object " + e + "]"
//             }
//         }
//         var I = S("String"),
//             N = S("Number"),
//             R = S("Date"),
//             k = S("RegExp"),
//             T = S("Error"),
//             j = S("Symbol"),
//             A = S("Map"),
//             B = S("WeakMap"),
//             w = S("Set"),
//             x = S("WeakSet"),
//             O = S("ArrayBuffer"),
//             F = S("DataView"),
//             L = c || S("Array"),
//             H = S("Function"),
//             D = t.document && t.document.childNodes;
//         "function" != typeof /./ && "object" != typeof Int8Array && "function" != typeof D && (H = function (e) {
//             return "function" == typeof e || !1
//         });
//         var q = H;

//         function U(e, t) {
//             return null != e && u.call(e, t)
//         }
//         var M = S("Arguments");
//         ! function () {
//             M(arguments) || (M = function (e) {
//                 return U(e, "callee")
//             })
//         }();
//         var V = M;

//         function P(e) {
//             return N(e) && h(e)
//         }

//         function _(e) {
//             return function () {
//                 return e
//             }
//         }

//         function J(e) {
//             return function (t) {
//                 var n = e(t);
//                 return "number" == typeof n && n >= 0 && n <= v
//             }
//         }

//         function Q(e) {
//             return function (t) {
//                 return null == t ? void 0 : t[e]
//             }
//         }
//         var $ = Q("byteLength"),
//             Y = J($),
//             W = /\[object ((I|Ui)nt(8|16|32)|Float(32|64)|Uint8Clamped|Big(I|Ui)nt64)Array\]/,
//             G = s ? function (e) {
//                 return p ? p(e) && !F(e) : Y(e) && W.test(l.call(e))
//             } : _(!1),
//             X = Q("length"),
//             z = J(X);

//         function K(e, t) {
//             t = function (e) {
//                 for (var t = {}, n = e.length, r = 0; r < n; ++r) t[e[r]] = !0;
//                 return {
//                     contains: function (e) {
//                         return t[e]
//                     },
//                     push: function (n) {
//                         return t[n] = !0, e.push(n)
//                     }
//                 }
//             }(t);
//             var n = y.length,
//                 a = e.constructor,
//                 o = q(a) && a.prototype || r,
//                 i = "constructor";
//             for (U(e, i) && !t.contains(i) && t.push(i); n--;)(i = y[n]) in e && e[i] !== o[i] && !t.contains(i) && t.push(i)
//         }

//         function Z(e) {
//             if (!b(e)) return [];
//             if (d) return d(e);
//             var t = [];
//             for (var n in e) U(e, n) && t.push(n);
//             return m && K(e, t), t
//         }

//         function ee(e, t) {
//             var n = Z(t),
//                 r = n.length;
//             if (null == e) return !r;
//             for (var a = Object(e), o = 0; o < r; o++) {
//                 var i = n[o];
//                 if (t[i] !== a[i] || !(i in a)) return !1
//             }
//             return !0
//         }

//         function te(e) {
//             return e instanceof te ? e : this instanceof te ? void(this._wrapped = e) : new te(e)
//         }

//         function ne(e) {
//             if (!b(e)) return [];
//             var t = [];
//             for (var n in e) t.push(n);
//             return m && K(e, t), t
//         }

//         function re(e) {
//             for (var t = Z(e), n = t.length, r = Array(n), a = 0; a < n; a++) r[a] = e[t[a]];
//             return r
//         }

//         function ae(e) {
//             for (var t = {}, n = Z(e), r = 0, a = n.length; r < a; r++) t[e[n[r]]] = n[r];
//             return t
//         }

//         function oe(e) {
//             var t = [];
//             for (var n in e) q(e[n]) && t.push(n);
//             return t.sort()
//         }

//         function ie(e, t) {
//             return function (n) {
//                 var r = arguments.length;
//                 if (t && (n = Object(n)), r < 2 || null == n) return n;
//                 for (var a = 1; a < r; a++)
//                     for (var o = arguments[a], i = e(o), l = i.length, u = 0; u < l; u++) {
//                         var s = i[u];
//                         t && void 0 !== n[s] || (n[s] = o[s])
//                     }
//                 return n
//             }
//         }
//         te.VERSION = e, te.prototype.value = function () {
//             return this._wrapped
//         }, te.prototype.valueOf = te.prototype.toJSON = te.prototype.value, te.prototype.toString = function () {
//             return String(this._wrapped)
//         };
//         var le = ie(ne),
//             ue = ie(Z),
//             se = ie(ne, !0);

//         function ce(e) {
//             if (!b(e)) return {};
//             if (f) return f(e);
//             var t = function () {};
//             t.prototype = e;
//             var n = new t;
//             return t.prototype = null, n
//         }

//         function de(e) {
//             return b(e) ? L(e) ? e.slice() : le({}, e) : e
//         }

//         function fe(e) {
//             return e
//         }

//         function pe(e) {
//             return e = ue({}, e),
//                 function (t) {
//                     return ee(t, e)
//                 }
//         }

//         function he(e, t) {
//             for (var n = t.length, r = 0; r < n; r++) {
//                 if (null == e) return;
//                 e = e[t[r]]
//             }
//             return n ? e : void 0
//         }

//         function ge(e) {
//             return L(e) ? function (t) {
//                 return he(t, e)
//             } : Q(e)
//         }

//         function me(e, t, n) {
//             if (void 0 === t) return e;
//             switch (null == n ? 3 : n) {
//             case 1:
//                 return function (n) {
//                     return e.call(t, n)
//                 };
//             case 3:
//                 return function (n, r, a) {
//                     return e.call(t, n, r, a)
//                 };
//             case 4:
//                 return function (n, r, a, o) {
//                     return e.call(t, n, r, a, o)
//                 }
//             }
//             return function () {
//                 return e.apply(t, arguments)
//             }
//         }

//         function ye(e, t, n) {
//             return null == e ? fe : q(e) ? me(e, t, n) : b(e) && !L(e) ? pe(e) : ge(e)
//         }

//         function ve(e, t) {
//             return ye(e, t, 1 / 0)
//         }

//         function Ce(e, t, n) {
//             return te.iteratee !== ve ? te.iteratee(e, t) : ye(e, t, n)
//         }

//         function be(e, t) {
//             return null == t && (t = e, e = 0), e + Math.floor(Math.random() * (t - e + 1))
//         }
//         te.iteratee = ve;
//         var Ee = Date.now || function () {
//             return (new Date).getTime()
//         };

//         function Se(e) {
//             var t = function (t) {
//                     return e[t]
//                 },
//                 n = "(?:" + Z(e).join("|") + ")",
//                 r = RegExp(n),
//                 a = RegExp(n, "g");
//             return function (e) {
//                 return e = null == e ? "" : "" + e, r.test(e) ? e.replace(a, t) : e
//             }
//         }
//         var Ie = {
//                 "&": "&amp;",
//                 "<": "&lt;",
//                 ">": "&gt;",
//                 '"': "&quot;",
//                 "'": "&#x27;",
//                 "`": "&#x60;"
//             },
//             Ne = Se(Ie),
//             Re = Se(ae(Ie)),
//             ke = te.templateSettings = {
//                 evaluate: /<%([\s\S]+?)%>/g,
//                 interpolate: /<%=([\s\S]+?)%>/g,
//                 escape: /<%-([\s\S]+?)%>/g
//             },
//             Te = /(.)^/,
//             je = {
//                 "'": "'",
//                 "\\": "\\",
//                 "\r": "r",
//                 "\n": "n",
//                 "\u2028": "u2028",
//                 "\u2029": "u2029"
//             },
//             Ae = /\\|'|\r|\n|\u2028|\u2029/g;

//         function Be(e) {
//             return "\\" + je[e]
//         }
//         var we = 0;

//         function xe(e, t, n, r, a) {
//             if (!(r instanceof t)) return e.apply(n, a);
//             var o = ce(e.prototype),
//                 i = e.apply(o, a);
//             return b(i) ? i : o
//         }
//         var Oe = C((function (e, t) {
//             var n = Oe.placeholder,
//                 r = function () {
//                     for (var a = 0, o = t.length, i = Array(o), l = 0; l < o; l++) i[l] = t[l] === n ? arguments[a++] : t[l];
//                     for (; a < arguments.length;) i.push(arguments[a++]);
//                     return xe(e, r, this, this, i)
//                 };
//             return r
//         }));
//         Oe.placeholder = te;
//         var Fe = C((function (e, t, n) {
//             if (!q(e)) throw new TypeError("Bind must be called on a function");
//             var r = C((function (a) {
//                 return xe(e, r, t, this, n.concat(a))
//             }));
//             return r
//         }));

//         function Le(e, t, n, r) {
//             if (r = r || [], t || 0 === t) {
//                 if (t <= 0) return r.concat(e)
//             } else t = 1 / 0;
//             for (var a = r.length, o = 0, i = X(e); o < i; o++) {
//                 var l = e[o];
//                 if (z(l) && (L(l) || V(l)))
//                     if (t > 1) Le(l, t - 1, n, r), a = r.length;
//                     else
//                         for (var u = 0, s = l.length; u < s;) r[a++] = l[u++];
//                 else n || (r[a++] = l)
//             }
//             return r
//         }
//         var He = C((function (e, t) {
//                 var n = (t = Le(t, !1, !1)).length;
//                 if (n < 1) throw new Error("bindAll must be passed function names");
//                 for (; n--;) {
//                     var r = t[n];
//                     e[r] = Fe(e[r], e)
//                 }
//                 return e
//             })),
//             De = C((function (e, t, n) {
//                 return setTimeout((function () {
//                     return e.apply(null, n)
//                 }), t)
//             })),
//             qe = Oe(De, te, 1);

//         function Ue(e) {
//             return function () {
//                 return !e.apply(this, arguments)
//             }
//         }

//         function Me(e, t) {
//             var n;
//             return function () {
//                 return --e > 0 && (n = t.apply(this, arguments)), e <= 1 && (t = null), n
//             }
//         }
//         var Ve = Oe(Me, 2);

//         function Pe(e, t, n) {
//             t = Ce(t, n);
//             for (var r, a = Z(e), o = 0, i = a.length; o < i; o++)
//                 if (t(e[r = a[o]], r, e)) return r
//         }

//         function _e(e) {
//             return function (t, n, r) {
//                 n = Ce(n, r);
//                 for (var a = X(t), o = e > 0 ? 0 : a - 1; o >= 0 && o < a; o += e)
//                     if (n(t[o], o, t)) return o;
//                 return -1
//             }
//         }
//         var Je = _e(1),
//             Qe = _e(-1);

//         function $e(e, t, n, r) {
//             for (var a = (n = Ce(n, r, 1))(t), o = 0, i = X(e); o < i;) {
//                 var l = Math.floor((o + i) / 2);
//                 n(e[l]) < a ? o = l + 1 : i = l
//             }
//             return o
//         }

//         function Ye(e, t, n) {
//             return function (r, a, o) {
//                 var l = 0,
//                     u = X(r);
//                 if ("number" == typeof o) e > 0 ? l = o >= 0 ? o : Math.max(o + u, l) : u = o >= 0 ? Math.min(o + 1, u) : o + u + 1;
//                 else if (n && o && u) return r[o = n(r, a)] === a ? o : -1;
//                 if (a != a) return (o = t(i.call(r, l, u), P)) >= 0 ? o + l : -1;
//                 for (o = e > 0 ? l : u - 1; o >= 0 && o < u; o += e)
//                     if (r[o] === a) return o;
//                 return -1
//             }
//         }
//         var We = Ye(1, Je, $e),
//             Ge = Ye(-1, Qe);

//         function Xe(e, t, n) {
//             var r = (z(e) ? Je : Pe)(e, t, n);
//             if (void 0 !== r && -1 !== r) return e[r]
//         }

//         function ze(e, t, n) {
//             var r, a;
//             if (t = me(t, n), z(e))
//                 for (r = 0, a = e.length; r < a; r++) t(e[r], r, e);
//             else {
//                 var o = Z(e);
//                 for (r = 0, a = o.length; r < a; r++) t(e[o[r]], o[r], e)
//             }
//             return e
//         }

//         function Ke(e, t, n) {
//             t = Ce(t, n);
//             for (var r = !z(e) && Z(e), a = (r || e).length, o = Array(a), i = 0; i < a; i++) {
//                 var l = r ? r[i] : i;
//                 o[i] = t(e[l], l, e)
//             }
//             return o
//         }

//         function Ze(e) {
//             var t = function (t, n, r, a) {
//                 var o = !z(t) && Z(t),
//                     i = (o || t).length,
//                     l = e > 0 ? 0 : i - 1;
//                 for (a || (r = t[o ? o[l] : l], l += e); l >= 0 && l < i; l += e) {
//                     var u = o ? o[l] : l;
//                     r = n(r, t[u], u, t)
//                 }
//                 return r
//             };
//             return function (e, n, r, a) {
//                 var o = arguments.length >= 3;
//                 return t(e, me(n, a, 4), r, o)
//             }
//         }
//         var et = Ze(1),
//             tt = Ze(-1);

//         function nt(e, t, n) {
//             var r = [];
//             return t = Ce(t, n), ze(e, (function (e, n, a) {
//                 t(e, n, a) && r.push(e)
//             })), r
//         }

//         function rt(e, t, n) {
//             t = Ce(t, n);
//             for (var r = !z(e) && Z(e), a = (r || e).length, o = 0; o < a; o++) {
//                 var i = r ? r[o] : o;
//                 if (!t(e[i], i, e)) return !1
//             }
//             return !0
//         }

//         function at(e, t, n) {
//             t = Ce(t, n);
//             for (var r = !z(e) && Z(e), a = (r || e).length, o = 0; o < a; o++) {
//                 var i = r ? r[o] : o;
//                 if (t(e[i], i, e)) return !0
//             }
//             return !1
//         }

//         function ot(e, t, n, r) {
//             return z(e) || (e = re(e)), ("number" != typeof n || r) && (n = 0), We(e, t, n) >= 0
//         }
//         var it = C((function (e, t, n) {
//             var r, a;
//             return q(t) ? a = t : L(t) && (r = t.slice(0, -1), t = t[t.length - 1]), Ke(e, (function (e) {
//                 var o = a;
//                 if (!o) {
//                     if (r && r.length && (e = he(e, r)), null == e) return;
//                     o = e[t]
//                 }
//                 return null == o ? o : o.apply(e, n)
//             }))
//         }));

//         function lt(e, t) {
//             return Ke(e, ge(t))
//         }

//         function ut(e, t, n) {
//             var r, a, o = -1 / 0,
//                 i = -1 / 0;
//             if (null == t || "number" == typeof t && "object" != typeof e[0] && null != e)
//                 for (var l = 0, u = (e = z(e) ? e : re(e)).length; l < u; l++) null != (r = e[l]) && r > o && (o = r);
//             else t = Ce(t, n), ze(e, (function (e, n, r) {
//                 ((a = t(e, n, r)) > i || a === -1 / 0 && o === -1 / 0) && (o = e, i = a)
//             }));
//             return o
//         }

//         function st(e, t, n) {
//             if (null == t || n) return z(e) || (e = re(e)), e[be(e.length - 1)];
//             var r = z(e) ? de(e) : re(e),
//                 a = X(r);
//             t = Math.max(Math.min(t, a), 0);
//             for (var o = a - 1, i = 0; i < t; i++) {
//                 var l = be(i, o),
//                     u = r[i];
//                 r[i] = r[l], r[l] = u
//             }
//             return r.slice(0, t)
//         }

//         function ct(e, t) {
//             return function (n, r, a) {
//                 var o = t ? [
//                     [],
//                     []
//                 ] : {};
//                 return r = Ce(r, a), ze(n, (function (t, a) {
//                     var i = r(t, a, n);
//                     e(o, t, i)
//                 })), o
//             }
//         }
//         var dt = ct((function (e, t, n) {
//                 U(e, n) ? e[n].push(t) : e[n] = [t]
//             })),
//             ft = ct((function (e, t, n) {
//                 e[n] = t
//             })),
//             pt = ct((function (e, t, n) {
//                 U(e, n) ? e[n]++ : e[n] = 1
//             })),
//             ht = ct((function (e, t, n) {
//                 e[n ? 0 : 1].push(t)
//             }), !0),
//             gt = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;

//         function mt(e, t, n) {
//             return t in n
//         }
//         var yt = C((function (e, t) {
//                 var n = {},
//                     r = t[0];
//                 if (null == e) return n;
//                 q(r) ? (t.length > 1 && (r = me(r, t[1])), t = ne(e)) : (r = mt, t = Le(t, !1, !1), e = Object(e));
//                 for (var a = 0, o = t.length; a < o; a++) {
//                     var i = t[a],
//                         l = e[i];
//                     r(l, i, e) && (n[i] = l)
//                 }
//                 return n
//             })),
//             vt = C((function (e, t) {
//                 var n, r = t[0];
//                 return q(r) ? (r = Ue(r), t.length > 1 && (n = t[1])) : (t = Ke(Le(t, !1, !1), String), r = function (e, n) {
//                     return !ot(t, n)
//                 }), yt(e, r, n)
//             }));

//         function Ct(e, t, n) {
//             return i.call(e, 0, Math.max(0, e.length - (null == t || n ? 1 : t)))
//         }

//         function bt(e, t, n) {
//             return null == e || e.length < 1 ? null == t || n ? void 0 : [] : null == t || n ? e[0] : Ct(e, e.length - t)
//         }

//         function Et(e, t, n) {
//             return i.call(e, null == t || n ? 1 : t)
//         }
//         var St = C((function (e, t) {
//                 return t = Le(t, !0, !0), nt(e, (function (e) {
//                     return !ot(t, e)
//                 }))
//             })),
//             It = C((function (e, t) {
//                 return St(e, t)
//             }));

//         function Nt(e, t, n, r) {
//             E(t) || (r = n, n = t, t = !1), null != n && (n = Ce(n, r));
//             for (var a = [], o = [], i = 0, l = X(e); i < l; i++) {
//                 var u = e[i],
//                     s = n ? n(u, i, e) : u;
//                 t && !n ? (i && o === s || a.push(u), o = s) : n ? ot(o, s) || (o.push(s), a.push(u)) : ot(a, u) || a.push(u)
//             }
//             return a
//         }
//         var Rt = C((function (e) {
//             return Nt(Le(e, !0, !0))
//         }));

//         function kt(e) {
//             for (var t = e && ut(e, X).length || 0, n = Array(t), r = 0; r < t; r++) n[r] = lt(e, r);
//             return n
//         }
//         var Tt = C(kt);

//         function jt(e, t) {
//             return e._chain ? te(t).chain() : t
//         }

//         function At(e) {
//             return ze(oe(e), (function (t) {
//                 var n = te[t] = e[t];
//                 te.prototype[t] = function () {
//                     var e = [this._wrapped];
//                     return o.apply(e, arguments), jt(this, n.apply(te, e))
//                 }
//             })), te
//         }
//         ze(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], (function (e) {
//             var t = n[e];
//             te.prototype[e] = function () {
//                 var n = this._wrapped;
//                 return null != n && (t.apply(n, arguments), "shift" !== e && "splice" !== e || 0 !== n.length || delete n[0]), jt(this, n)
//             }
//         })), ze(["concat", "join", "slice"], (function (e) {
//             var t = n[e];
//             te.prototype[e] = function () {
//                 var e = this._wrapped;
//                 return null != e && (e = t.apply(e, arguments)), jt(this, e)
//             }
//         }));
//         var Bt = At({
//             __proto__: null,
//             VERSION: e,
//             restArguments: C,
//             isObject: b,
//             isNull: function (e) {
//                 return null === e
//             },
//             isUndefined: function (e) {
//                 return void 0 === e
//             },
//             isBoolean: E,
//             isElement: function (e) {
//                 return !(!e || 1 !== e.nodeType)
//             },
//             isString: I,
//             isNumber: N,
//             isDate: R,
//             isRegExp: k,
//             isError: T,
//             isSymbol: j,
//             isMap: A,
//             isWeakMap: B,
//             isSet: w,
//             isWeakSet: x,
//             isArrayBuffer: O,
//             isDataView: F,
//             isArray: L,
//             isFunction: q,
//             isArguments: V,
//             isFinite: function (e) {
//                 return !j(e) && g(e) && !isNaN(parseFloat(e))
//             },
//             isNaN: P,
//             isTypedArray: G,
//             isEmpty: function (e) {
//                 return null == e || (z(e) && (L(e) || I(e) || V(e)) ? 0 === e.length : 0 === Z(e).length)
//             },
//             isMatch: ee,
//             isEqual: function (e, t) {
//                 return function e(t, n, r, o) {
//                     if (t === n) return 0 !== t || 1 / t == 1 / n;
//                     if (null == t || null == n) return !1;
//                     if (t != t) return n != n;
//                     var i = typeof t;
//                     return ("function" === i || "object" === i || "object" == typeof n) && function t(n, r, o, i) {
//                         n instanceof te && (n = n._wrapped), r instanceof te && (r = r._wrapped);
//                         var u = l.call(n);
//                         if (u !== l.call(r)) return !1;
//                         switch (u) {
//                         case "[object RegExp]":
//                         case "[object String]":
//                             return "" + n == "" + r;
//                         case "[object Number]":
//                             return +n != +n ? +r != +r : 0 == +n ? 1 / +n == 1 / r : +n == +r;
//                         case "[object Date]":
//                         case "[object Boolean]":
//                             return +n == +r;
//                         case "[object Symbol]":
//                             return a.valueOf.call(n) === a.valueOf.call(r);
//                         case "[object ArrayBuffer]":
//                             return t(new DataView(n), new DataView(r), o, i);
//                         case "[object DataView]":
//                             var s = $(n);
//                             if (s !== $(r)) return !1;
//                             for (; s--;)
//                                 if (n.getUint8(s) !== r.getUint8(s)) return !1;
//                             return !0
//                         }
//                         if (G(n)) return t(new DataView(n.buffer), new DataView(r.buffer), o, i);
//                         var c = "[object Array]" === u;
//                         if (!c) {
//                             if ("object" != typeof n || "object" != typeof r) return !1;
//                             var d = n.constructor,
//                                 f = r.constructor;
//                             if (d !== f && !(q(d) && d instanceof d && q(f) && f instanceof f) && "constructor" in n && "constructor" in r) return !1
//                         }
//                         i = i || [];
//                         for (var p = (o = o || []).length; p--;)
//                             if (o[p] === n) return i[p] === r;
//                         if (o.push(n), i.push(r), c) {
//                             if ((p = n.length) !== r.length) return !1;
//                             for (; p--;)
//                                 if (!e(n[p], r[p], o, i)) return !1
//                         } else {
//                             var h, g = Z(n);
//                             if (p = g.length, Z(r).length !== p) return !1;
//                             for (; p--;)
//                                 if (!U(r, h = g[p]) || !e(n[h], r[h], o, i)) return !1
//                         }
//                         return o.pop(), i.pop(), !0
//                     }(t, n, r, o)
//                 }(e, t)
//             },
//             keys: Z,
//             allKeys: ne,
//             values: re,
//             pairs: function (e) {
//                 for (var t = Z(e), n = t.length, r = Array(n), a = 0; a < n; a++) r[a] = [t[a], e[t[a]]];
//                 return r
//             },
//             invert: ae,
//             functions: oe,
//             methods: oe,
//             extend: le,
//             extendOwn: ue,
//             assign: ue,
//             defaults: se,
//             create: function (e, t) {
//                 var n = ce(e);
//                 return t && ue(n, t), n
//             },
//             clone: de,
//             tap: function (e, t) {
//                 return t(e), e
//             },
//             has: function (e, t) {
//                 if (!L(t)) return U(e, t);
//                 for (var n = t.length, r = 0; r < n; r++) {
//                     var a = t[r];
//                     if (null == e || !u.call(e, a)) return !1;
//                     e = e[a]
//                 }
//                 return !!n
//             },
//             mapObject: function (e, t, n) {
//                 t = Ce(t, n);
//                 for (var r = Z(e), a = r.length, o = {}, i = 0; i < a; i++) {
//                     var l = r[i];
//                     o[l] = t(e[l], l, e)
//                 }
//                 return o
//             },
//             identity: fe,
//             constant: _,
//             noop: function () {},
//             property: ge,
//             propertyOf: function (e) {
//                 return null == e ? function () {} : function (t) {
//                     return L(t) ? he(e, t) : e[t]
//                 }
//             },
//             matcher: pe,
//             matches: pe,
//             times: function (e, t, n) {
//                 var r = Array(Math.max(0, e));
//                 t = me(t, n, 1);
//                 for (var a = 0; a < e; a++) r[a] = t(a);
//                 return r
//             },
//             random: be,
//             now: Ee,
//             escape: Ne,
//             unescape: Re,
//             templateSettings: ke,
//             template: function (e, t, n) {
//                 !t && n && (t = n), t = se({}, t, te.templateSettings);
//                 var r, a = RegExp([(t.escape || Te).source, (t.interpolate || Te).source, (t.evaluate || Te).source].join("|") + "|$", "g"),
//                     o = 0,
//                     i = "__p+='";
//                 e.replace(a, (function (t, n, r, a, l) {
//                     return i += e.slice(o, l).replace(Ae, Be), o = l + t.length, n ? i += "'+\n((__t=(" + n + "))==null?'':_.escape(__t))+\n'" : r ? i += "'+\n((__t=(" + r + "))==null?'':__t)+\n'" : a && (i += "';\n" + a + "\n__p+='"), t
//                 })), i += "';\n", t.variable || (i = "with(obj||{}){\n" + i + "}\n"), i = "var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};\n" + i + "return __p;\n";
//                 try {
//                     r = new Function(t.variable || "obj", "_", i)
//                 } catch (e) {
//                     throw e.source = i, e
//                 }
//                 var l = function (e) {
//                         return r.call(this, e, te)
//                     },
//                     u = t.variable || "obj";
//                 return l.source = "function(" + u + "){\n" + i + "}", l
//             },
//             result: function (e, t, n) {
//                 L(t) || (t = [t]);
//                 var r = t.length;
//                 if (!r) return q(n) ? n.call(e) : n;
//                 for (var a = 0; a < r; a++) {
//                     var o = null == e ? void 0 : e[t[a]];
//                     void 0 === o && (o = n, a = r), e = q(o) ? o.call(e) : o
//                 }
//                 return e
//             },
//             uniqueId: function (e) {
//                 var t = ++we + "";
//                 return e ? e + t : t
//             },
//             chain: function (e) {
//                 var t = te(e);
//                 return t._chain = !0, t
//             },
//             iteratee: ve,
//             partial: Oe,
//             bind: Fe,
//             bindAll: He,
//             memoize: function (e, t) {
//                 var n = function (r) {
//                     var a = n.cache,
//                         o = "" + (t ? t.apply(this, arguments) : r);
//                     return U(a, o) || (a[o] = e.apply(this, arguments)), a[o]
//                 };
//                 return n.cache = {}, n
//             },
//             delay: De,
//             defer: qe,
//             throttle: function (e, t, n) {
//                 var r, a, o, i, l = 0;
//                 n || (n = {});
//                 var u = function () {
//                         l = !1 === n.leading ? 0 : Ee(), r = null, i = e.apply(a, o), r || (a = o = null)
//                     },
//                     s = function () {
//                         var s = Ee();
//                         l || !1 !== n.leading || (l = s);
//                         var c = t - (s - l);
//                         return a = this, o = arguments, c <= 0 || c > t ? (r && (clearTimeout(r), r = null), l = s, i = e.apply(a, o), r || (a = o = null)) : r || !1 === n.trailing || (r = setTimeout(u, c)), i
//                     };
//                 return s.cancel = function () {
//                     clearTimeout(r), l = 0, r = a = o = null
//                 }, s
//             },
//             debounce: function (e, t, n) {
//                 var r, a, o = function (t, n) {
//                         r = null, n && (a = e.apply(t, n))
//                     },
//                     i = C((function (i) {
//                         if (r && clearTimeout(r), n) {
//                             var l = !r;
//                             r = setTimeout(o, t), l && (a = e.apply(this, i))
//                         } else r = De(o, t, this, i);
//                         return a
//                     }));
//                 return i.cancel = function () {
//                     clearTimeout(r), r = null
//                 }, i
//             },
//             wrap: function (e, t) {
//                 return Oe(t, e)
//             },
//             negate: Ue,
//             compose: function () {
//                 var e = arguments,
//                     t = e.length - 1;
//                 return function () {
//                     for (var n = t, r = e[t].apply(this, arguments); n--;) r = e[n].call(this, r);
//                     return r
//                 }
//             },
//             after: function (e, t) {
//                 return function () {
//                     if (--e < 1) return t.apply(this, arguments)
//                 }
//             },
//             before: Me,
//             once: Ve,
//             findKey: Pe,
//             findIndex: Je,
//             findLastIndex: Qe,
//             sortedIndex: $e,
//             indexOf: We,
//             lastIndexOf: Ge,
//             find: Xe,
//             detect: Xe,
//             findWhere: function (e, t) {
//                 return Xe(e, pe(t))
//             },
//             each: ze,
//             forEach: ze,
//             map: Ke,
//             collect: Ke,
//             reduce: et,
//             foldl: et,
//             inject: et,
//             reduceRight: tt,
//             foldr: tt,
//             filter: nt,
//             select: nt,
//             reject: function (e, t, n) {
//                 return nt(e, Ue(Ce(t)), n)
//             },
//             every: rt,
//             all: rt,
//             some: at,
//             any: at,
//             contains: ot,
//             includes: ot,
//             include: ot,
//             invoke: it,
//             pluck: lt,
//             where: function (e, t) {
//                 return nt(e, pe(t))
//             },
//             max: ut,
//             min: function (e, t, n) {
//                 var r, a, o = 1 / 0,
//                     i = 1 / 0;
//                 if (null == t || "number" == typeof t && "object" != typeof e[0] && null != e)
//                     for (var l = 0, u = (e = z(e) ? e : re(e)).length; l < u; l++) null != (r = e[l]) && r < o && (o = r);
//                 else t = Ce(t, n), ze(e, (function (e, n, r) {
//                     ((a = t(e, n, r)) < i || a === 1 / 0 && o === 1 / 0) && (o = e, i = a)
//                 }));
//                 return o
//             },
//             shuffle: function (e) {
//                 return st(e, 1 / 0)
//             },
//             sample: st,
//             sortBy: function (e, t, n) {
//                 var r = 0;
//                 return t = Ce(t, n), lt(Ke(e, (function (e, n, a) {
//                     return {
//                         value: e,
//                         index: r++,
//                         criteria: t(e, n, a)
//                     }
//                 })).sort((function (e, t) {
//                     var n = e.criteria,
//                         r = t.criteria;
//                     if (n !== r) {
//                         if (n > r || void 0 === n) return 1;
//                         if (n < r || void 0 === r) return -1
//                     }
//                     return e.index - t.index
//                 })), "value")
//             },
//             groupBy: dt,
//             indexBy: ft,
//             countBy: pt,
//             partition: ht,
//             toArray: function (e) {
//                 return e ? L(e) ? i.call(e) : I(e) ? e.match(gt) : z(e) ? Ke(e, fe) : re(e) : []
//             },
//             size: function (e) {
//                 return null == e ? 0 : z(e) ? e.length : Z(e).length
//             },
//             pick: yt,
//             omit: vt,
//             first: bt,
//             head: bt,
//             take: bt,
//             initial: Ct,
//             last: function (e, t, n) {
//                 return null == e || e.length < 1 ? null == t || n ? void 0 : [] : null == t || n ? e[e.length - 1] : Et(e, Math.max(0, e.length - t))
//             },
//             rest: Et,
//             tail: Et,
//             drop: Et,
//             compact: function (e) {
//                 return nt(e, Boolean)
//             },
//             flatten: function (e, t) {
//                 return Le(e, t, !1)
//             },
//             without: It,
//             uniq: Nt,
//             unique: Nt,
//             union: Rt,
//             intersection: function (e) {
//                 for (var t = [], n = arguments.length, r = 0, a = X(e); r < a; r++) {
//                     var o = e[r];
//                     if (!ot(t, o)) {
//                         var i;
//                         for (i = 1; i < n && ot(arguments[i], o); i++);
//                         i === n && t.push(o)
//                     }
//                 }
//                 return t
//             },
//             difference: St,
//             unzip: kt,
//             transpose: kt,
//             zip: Tt,
//             object: function (e, t) {
//                 for (var n = {}, r = 0, a = X(e); r < a; r++) t ? n[e[r]] = t[r] : n[e[r][0]] = e[r][1];
//                 return n
//             },
//             range: function (e, t, n) {
//                 null == t && (t = e || 0, e = 0), n || (n = t < e ? -1 : 1);
//                 for (var r = Math.max(Math.ceil((t - e) / n), 0), a = Array(r), o = 0; o < r; o++, e += n) a[o] = e;
//                 return a
//             },
//             chunk: function (e, t) {
//                 if (null == t || t < 1) return [];
//                 for (var n = [], r = 0, a = e.length; r < a;) n.push(i.call(e, r, r += t));
//                 return n
//             },
//             mixin: At,
//             default: te
//         });
//         return Bt._ = Bt, Bt
//     }));